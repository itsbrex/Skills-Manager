use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthTokens {
    pub access_token: String,
    pub refresh_token: String,
}

pub trait TokenStore: Send + Sync {
    fn save_tokens(&self, provider: &str, tokens: AuthTokens) -> Result<(), String>;
    fn load_tokens(&self, provider: &str) -> Result<Option<AuthTokens>, String>;
    fn clear_tokens(&self, provider: &str) -> Result<(), String>;
}

pub struct KeychainTokenStore;

impl KeychainTokenStore {
    fn entry(provider: &str) -> Result<keyring::Entry, String> {
        keyring::Entry::new("skills-manager", &format!("auth:{provider}"))
            .map_err(|e| format!("keyring init failed: {e}"))
    }
}

impl TokenStore for KeychainTokenStore {
    fn save_tokens(&self, provider: &str, tokens: AuthTokens) -> Result<(), String> {
        let entry = Self::entry(provider)?;
        let payload = serde_json::to_string(&tokens).map_err(|e| e.to_string())?;
        entry
            .set_password(&payload)
            .map_err(|e| format!("save keychain failed: {e}"))
    }

    fn load_tokens(&self, provider: &str) -> Result<Option<AuthTokens>, String> {
        let entry = Self::entry(provider)?;
        match entry.get_password() {
            Ok(raw) => Ok(Some(
                serde_json::from_str(&raw).map_err(|e| e.to_string())?,
            )),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(err) => Err(format!("load keychain failed: {err}")),
        }
    }

    fn clear_tokens(&self, provider: &str) -> Result<(), String> {
        let entry = Self::entry(provider)?;
        match entry.delete_password() {
            Ok(_) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()),
            Err(err) => Err(format!("clear keychain failed: {err}")),
        }
    }
}

#[derive(Default, Clone)]
pub struct MemoryTokenStore {
    inner: Arc<Mutex<HashMap<String, AuthTokens>>>,
}

impl TokenStore for MemoryTokenStore {
    fn save_tokens(&self, provider: &str, tokens: AuthTokens) -> Result<(), String> {
        self.inner
            .lock()
            .map_err(|_| "lock".to_string())?
            .insert(provider.to_string(), tokens);
        Ok(())
    }

    fn load_tokens(&self, provider: &str) -> Result<Option<AuthTokens>, String> {
        Ok(self
            .inner
            .lock()
            .map_err(|_| "lock".to_string())?
            .get(provider)
            .cloned())
    }

    fn clear_tokens(&self, provider: &str) -> Result<(), String> {
        self.inner
            .lock()
            .map_err(|_| "lock".to_string())?
            .remove(provider);
        Ok(())
    }
}

static TOKEN_STORE: OnceLock<Arc<dyn TokenStore>> = OnceLock::new();
static TEST_TOKEN_STORE: OnceLock<Mutex<Option<Arc<dyn TokenStore>>>> = OnceLock::new();

fn test_store_cell() -> &'static Mutex<Option<Arc<dyn TokenStore>>> {
    TEST_TOKEN_STORE.get_or_init(|| Mutex::new(None))
}

pub fn token_store() -> Arc<dyn TokenStore> {
    if let Ok(guard) = test_store_cell().lock() {
        if let Some(store) = guard.as_ref() {
            return store.clone();
        }
    }
    TOKEN_STORE
        .get_or_init(|| Arc::new(KeychainTokenStore))
        .clone()
}

#[cfg(test)]
pub fn set_token_store_for_tests<T: TokenStore + 'static>(store: T) {
    if let Ok(mut guard) = test_store_cell().lock() {
        *guard = Some(Arc::new(store));
    }
}

#[cfg(test)]
pub fn clear_token_store_for_tests() {
    if let Ok(mut guard) = test_store_cell().lock() {
        *guard = None;
    }
}
