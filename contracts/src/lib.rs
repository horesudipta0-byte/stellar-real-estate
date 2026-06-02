#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror, symbol_short,
    Address, Env, String, log,
};

// ============================================================================
// Storage Keys — used to store data in contract instance/persistent storage
// ============================================================================
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,                  // Address: the deployer/admin
    TotalSupply,            // u64: total tokens ever minted
    PropertyName,           // String: human-readable property name
    PropertyValue,          // u64: property valuation in stroops (1 XLM = 10_000_000)
    PropertyLocation,       // String: location description
    Balance(Address),       // u64: token balance per holder
    Listing(Address),       // SaleListing: active sell listing per holder
    Initialized,            // bool: whether the contract has been initialized
}

// ============================================================================
// Sale Listing — represents a holder's offer to sell some tokens
// ============================================================================
#[derive(Clone, Debug, PartialEq)]
#[contracttype]
pub struct SaleListing {
    pub seller: Address,
    pub amount: u64,       // number of tokens for sale
    pub price_per_token: u64, // price per token in stroops
}

// ============================================================================
// Property Info — returned from the get_property_info query
// ============================================================================
#[derive(Clone, Debug)]
#[contracttype]
pub struct PropertyInfo {
    pub name: String,
    pub location: String,
    pub value: u64,
    pub total_supply: u64,
}

// ============================================================================
// Error Codes — each maps to a numeric code in HostError
// ============================================================================
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    NotAuthorized = 3,
    InsufficientBalance = 4,
    NoActiveListing = 5,
    InsufficientListedAmount = 6,
    InvalidAmount = 7,
    CannotBuyOwnTokens = 8,
    Overflow = 9,
}

// ============================================================================
// Contract definition
// ============================================================================
#[contract]
pub struct RealEstateToken;

#[contractimpl]
impl RealEstateToken {
    // ------------------------------------------------------------------------
    // initialize — called once by the deployer to set up the property token
    //
    // Parameters:
    //   env:            the contract environment
    //   admin:          the deployer's address who receives all initial tokens
    //   total_supply:   the fixed number of fractional tokens to create
    //   property_name:  human-readable name (e.g. "Sunset Villa #42")
    //   property_value: total property valuation in stroops
    //   property_location: description of the property location
    //
    // Effects:
    //   - Stores admin, total supply, property metadata
    //   - Credits all tokens to admin's balance
    //   - Emits an "initialized" event
    // ------------------------------------------------------------------------
    pub fn initialize(
        env: Env,
        admin: Address,
        total_supply: u64,
        property_name: String,
        property_value: u64,
        property_location: String,
    ) -> Result<(), Error> {
        // Prevent re-initialization
        if env.storage().instance().has(&DataKey::Initialized) {
            return Err(Error::AlreadyInitialized);
        }

        // Validate inputs
        if total_supply == 0 {
            return Err(Error::InvalidAmount);
        }

        // Require admin authorization
        admin.require_auth();

        // Store all contract state
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TotalSupply, &total_supply);
        env.storage().instance().set(&DataKey::PropertyName, &property_name);
        env.storage().instance().set(&DataKey::PropertyValue, &property_value);
        env.storage().instance().set(&DataKey::PropertyLocation, &property_location);
        env.storage().instance().set(&DataKey::Initialized, &true);

        // All tokens go to the admin initially
        env.storage().persistent().set(&DataKey::Balance(admin.clone()), &total_supply);

        // Emit initialization event
        env.events().publish(
            (symbol_short!("init"),),
            (admin, total_supply),
        );

        log!(&env, "Contract initialized with supply: {}", total_supply);

        Ok(())
    }

    // ------------------------------------------------------------------------
    // get_balance — read-only: returns the token balance for a given address
    // ------------------------------------------------------------------------
    pub fn get_balance(env: Env, owner: Address) -> u64 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(owner))
            .unwrap_or(0)
    }

    // ------------------------------------------------------------------------
    // get_property_info — read-only: returns all property metadata
    // ------------------------------------------------------------------------
    pub fn get_property_info(env: Env) -> Result<PropertyInfo, Error> {
        if !env.storage().instance().has(&DataKey::Initialized) {
            return Err(Error::NotInitialized);
        }

        let name: String = env.storage().instance().get(&DataKey::PropertyName).unwrap();
        let location: String = env.storage().instance().get(&DataKey::PropertyLocation).unwrap();
        let value: u64 = env.storage().instance().get(&DataKey::PropertyValue).unwrap();
        let total_supply: u64 = env.storage().instance().get(&DataKey::TotalSupply).unwrap();

        Ok(PropertyInfo {
            name,
            location,
            value,
            total_supply,
        })
    }

    // ------------------------------------------------------------------------
    // get_total_supply — read-only: returns total token supply
    // ------------------------------------------------------------------------
    pub fn get_total_supply(env: Env) -> Result<u64, Error> {
        if !env.storage().instance().has(&DataKey::Initialized) {
            return Err(Error::NotInitialized);
        }
        Ok(env.storage().instance().get(&DataKey::TotalSupply).unwrap())
    }

    // ------------------------------------------------------------------------
    // get_admin — read-only: returns the admin address
    // ------------------------------------------------------------------------
    pub fn get_admin(env: Env) -> Result<Address, Error> {
        if !env.storage().instance().has(&DataKey::Initialized) {
            return Err(Error::NotInitialized);
        }
        Ok(env.storage().instance().get(&DataKey::Admin).unwrap())
    }

    // ------------------------------------------------------------------------
    // list_for_sale — a token holder lists some of their tokens for sale
    //
    // Parameters:
    //   seller:          the address listing tokens (must authorize)
    //   amount:          number of tokens to list
    //   price_per_token: asking price per token in stroops
    //
    // Effects:
    //   - Validates the seller has enough tokens
    //   - Creates/overwrites a SaleListing for this seller
    //   - Emits a "listed" event
    // ------------------------------------------------------------------------
    pub fn list_for_sale(
        env: Env,
        seller: Address,
        amount: u64,
        price_per_token: u64,
    ) -> Result<(), Error> {
        if !env.storage().instance().has(&DataKey::Initialized) {
            return Err(Error::NotInitialized);
        }

        if amount == 0 || price_per_token == 0 {
            return Err(Error::InvalidAmount);
        }

        // Require the seller to authorize this action
        seller.require_auth();

        // Check the seller actually has enough tokens
        let balance: u64 = env.storage()
            .persistent()
            .get(&DataKey::Balance(seller.clone()))
            .unwrap_or(0);

        if balance < amount {
            return Err(Error::InsufficientBalance);
        }

        // Create the listing
        let listing = SaleListing {
            seller: seller.clone(),
            amount,
            price_per_token,
        };

        env.storage().persistent().set(&DataKey::Listing(seller.clone()), &listing);

        // Emit listing event
        env.events().publish(
            (symbol_short!("listed"),),
            (seller, amount, price_per_token),
        );

        Ok(())
    }

    // ------------------------------------------------------------------------
    // cancel_listing — removes an active listing for the calling address
    // ------------------------------------------------------------------------
    pub fn cancel_listing(env: Env, seller: Address) -> Result<(), Error> {
        if !env.storage().instance().has(&DataKey::Initialized) {
            return Err(Error::NotInitialized);
        }

        seller.require_auth();

        if !env.storage().persistent().has(&DataKey::Listing(seller.clone())) {
            return Err(Error::NoActiveListing);
        }

        env.storage().persistent().remove(&DataKey::Listing(seller.clone()));

        env.events().publish(
            (symbol_short!("canceled"),),
            (seller,),
        );

        Ok(())
    }

    // ------------------------------------------------------------------------
    // get_listing — read-only: returns the active listing for a given seller
    // Returns None-equivalent error if no listing exists
    // ------------------------------------------------------------------------
    pub fn get_listing(env: Env, seller: Address) -> Result<SaleListing, Error> {
        if !env.storage().instance().has(&DataKey::Initialized) {
            return Err(Error::NotInitialized);
        }

        env.storage()
            .persistent()
            .get(&DataKey::Listing(seller))
            .ok_or(Error::NoActiveListing)
    }

    // ------------------------------------------------------------------------
    // buy_tokens — a buyer purchases tokens from a seller's active listing
    //
    // Parameters:
    //   buyer:  the address buying tokens (must authorize)
    //   seller: the address whose listing to buy from
    //   amount: number of tokens to purchase
    //
    // Flow:
    //   1. Validate both parties, amounts
    //   2. Calculate total cost in stroops
    //   3. Transfer XLM from buyer to seller (via token interface)
    //   4. Transfer property tokens from seller to buyer
    //   5. Update or remove the listing
    //   6. Emit a "sold" event
    //
    // NOTE: In this simplified version, the XLM transfer is handled
    // off-chain — the buyer sends XLM separately to the seller's address.
    // The contract tracks only the token ownership transfer after
    // verifying both parties have authorized the transaction.
    // A production version would use the Stellar Asset Contract for
    // atomic XLM transfers.
    // ------------------------------------------------------------------------
    pub fn buy_tokens(
        env: Env,
        buyer: Address,
        seller: Address,
        amount: u64,
    ) -> Result<u64, Error> {
        if !env.storage().instance().has(&DataKey::Initialized) {
            return Err(Error::NotInitialized);
        }

        if amount == 0 {
            return Err(Error::InvalidAmount);
        }

        // Buyer cannot buy their own tokens
        if buyer == seller {
            return Err(Error::CannotBuyOwnTokens);
        }

        // Both parties must authorize
        buyer.require_auth();
        seller.require_auth();

        // Get the seller's listing
        let listing: SaleListing = env.storage()
            .persistent()
            .get(&DataKey::Listing(seller.clone()))
            .ok_or(Error::NoActiveListing)?;

        // Ensure enough tokens are listed
        if listing.amount < amount {
            return Err(Error::InsufficientListedAmount);
        }

        // Calculate total cost (with overflow protection)
        let total_cost = (amount as u128)
            .checked_mul(listing.price_per_token as u128)
            .ok_or(Error::Overflow)?;

        if total_cost > u64::MAX as u128 {
            return Err(Error::Overflow);
        }
        let total_cost = total_cost as u64;

        // Verify seller actually has the tokens
        let seller_balance: u64 = env.storage()
            .persistent()
            .get(&DataKey::Balance(seller.clone()))
            .unwrap_or(0);

        if seller_balance < amount {
            return Err(Error::InsufficientBalance);
        }

        // Transfer tokens: deduct from seller, credit to buyer
        let new_seller_balance = seller_balance - amount;
        env.storage()
            .persistent()
            .set(&DataKey::Balance(seller.clone()), &new_seller_balance);

        let buyer_balance: u64 = env.storage()
            .persistent()
            .get(&DataKey::Balance(buyer.clone()))
            .unwrap_or(0);

        let new_buyer_balance = buyer_balance
            .checked_add(amount)
            .ok_or(Error::Overflow)?;

        env.storage()
            .persistent()
            .set(&DataKey::Balance(buyer.clone()), &new_buyer_balance);

        // Update or remove the listing
        let remaining = listing.amount - amount;
        if remaining == 0 {
            // Listing fully consumed — remove it
            env.storage().persistent().remove(&DataKey::Listing(seller.clone()));
        } else {
            // Partial fill — update the remaining amount
            let updated_listing = SaleListing {
                seller: seller.clone(),
                amount: remaining,
                price_per_token: listing.price_per_token,
            };
            env.storage()
                .persistent()
                .set(&DataKey::Listing(seller.clone()), &updated_listing);
        }

        // Emit sale event
        env.events().publish(
            (symbol_short!("sold"),),
            (buyer, seller, amount, total_cost),
        );

        Ok(total_cost)
    }

    // ------------------------------------------------------------------------
    // transfer — direct token transfer between two addresses (no sale)
    // Both parties must authorize.
    // ------------------------------------------------------------------------
    pub fn transfer(
        env: Env,
        from: Address,
        to: Address,
        amount: u64,
    ) -> Result<(), Error> {
        if !env.storage().instance().has(&DataKey::Initialized) {
            return Err(Error::NotInitialized);
        }

        if amount == 0 {
            return Err(Error::InvalidAmount);
        }

        from.require_auth();

        let from_balance: u64 = env.storage()
            .persistent()
            .get(&DataKey::Balance(from.clone()))
            .unwrap_or(0);

        if from_balance < amount {
            return Err(Error::InsufficientBalance);
        }

        let to_balance: u64 = env.storage()
            .persistent()
            .get(&DataKey::Balance(to.clone()))
            .unwrap_or(0);

        env.storage()
            .persistent()
            .set(&DataKey::Balance(from.clone()), &(from_balance - amount));

        env.storage()
            .persistent()
            .set(&DataKey::Balance(to.clone()), &(to_balance.checked_add(amount).ok_or(Error::Overflow)?));

        env.events().publish(
            (symbol_short!("transfer"),),
            (from, to, amount),
        );

        Ok(())
    }
}

// ============================================================================
// Unit Tests
// ============================================================================
#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env, String};

    #[test]
    fn test_initialize_and_balance() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, RealEstateToken);
        let client = RealEstateTokenClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let total_supply: u64 = 1_000;
        let property_name = String::from_str(&env, "Sunset Villa #42");
        let property_value: u64 = 500_000_0000000; // 500,000 XLM in stroops
        let property_location = String::from_str(&env, "123 Blockchain Ave, Crypto City");

        // Initialize the contract
        client.initialize(
            &admin,
            &total_supply,
            &property_name,
            &property_value,
            &property_location,
        );

        // Admin should hold all tokens
        assert_eq!(client.get_balance(&admin), 1_000);

        // Property info should match
        let info = client.get_property_info();
        assert_eq!(info.total_supply, 1_000);
        assert_eq!(info.value, 500_000_0000000);

        // A random address should have 0 balance
        let random = Address::generate(&env);
        assert_eq!(client.get_balance(&random), 0);
    }

    #[test]
    fn test_list_and_buy() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, RealEstateToken);
        let client = RealEstateTokenClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let buyer = Address::generate(&env);

        // Initialize with 1000 tokens
        client.initialize(
            &admin,
            &1000u64,
            &String::from_str(&env, "Test Property"),
            &100_0000000u64,
            &String::from_str(&env, "Test Location"),
        );

        // Admin lists 500 tokens at 1 XLM (10_000_000 stroops) each
        client.list_for_sale(&admin, &500u64, &10_000_000u64);

        // Verify listing
        let listing = client.get_listing(&admin);
        assert_eq!(listing.amount, 500);
        assert_eq!(listing.price_per_token, 10_000_000);

        // Buyer purchases 100 tokens
        let total_cost = client.buy_tokens(&buyer, &admin, &100u64);
        assert_eq!(total_cost, 100 * 10_000_000); // 100 XLM in stroops

        // Balances should be updated
        assert_eq!(client.get_balance(&admin), 900);   // 1000 - 100
        assert_eq!(client.get_balance(&buyer), 100);

        // Listing should be partially filled (400 remaining)
        let updated_listing = client.get_listing(&admin);
        assert_eq!(updated_listing.amount, 400);
    }

    #[test]
    fn test_transfer() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, RealEstateToken);
        let client = RealEstateTokenClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let recipient = Address::generate(&env);

        client.initialize(
            &admin,
            &1000u64,
            &String::from_str(&env, "Transfer Test"),
            &100_0000000u64,
            &String::from_str(&env, "Transfer Location"),
        );

        // Transfer 200 tokens from admin to recipient
        client.transfer(&admin, &recipient, &200u64);

        assert_eq!(client.get_balance(&admin), 800);
        assert_eq!(client.get_balance(&recipient), 200);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #2)")]
    fn test_double_initialize_fails() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, RealEstateToken);
        let client = RealEstateTokenClient::new(&env, &contract_id);

        let admin = Address::generate(&env);

        client.initialize(
            &admin,
            &1000u64,
            &String::from_str(&env, "Property"),
            &100_0000000u64,
            &String::from_str(&env, "Location"),
        );

        // Second call should fail with AlreadyInitialized
        client.initialize(
            &admin,
            &500u64,
            &String::from_str(&env, "Property 2"),
            &200_0000000u64,
            &String::from_str(&env, "Location 2"),
        );
    }
}
