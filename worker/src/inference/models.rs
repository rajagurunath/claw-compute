use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ModelEntry {
    pub id: &'static str,
    pub hf_repo: &'static str,
    pub min_ram_gb: u32,
    pub disk_gb: u32,
}

pub const CATALOG: &[ModelEntry] = &[
    ModelEntry {
        id: "qwen",
        hf_repo: "mlx-community/Qwen3.5-7B-Instruct-4bit",
        min_ram_gb: 16,
        disk_gb: 5,
    },
    ModelEntry {
        id: "gemma",
        hf_repo: "mlx-community/gemma-3-12b-it-4bit",
        min_ram_gb: 24,
        disk_gb: 8,
    },
    ModelEntry {
        id: "qwen-30b",
        hf_repo: "mlx-community/Qwen3.5-30B-A3B-Instruct-4bit",
        min_ram_gb: 36,
        disk_gb: 17,
    },
];

pub fn lookup(id: &str) -> Option<&'static ModelEntry> {
    CATALOG.iter().find(|e| e.id == id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_qwen_present() {
        let e = lookup("qwen").expect("qwen entry must exist");
        assert_eq!(e.hf_repo, "mlx-community/Qwen3.5-7B-Instruct-4bit");
        assert_eq!(e.min_ram_gb, 16);
    }

    #[test]
    fn unknown_model_returns_none() {
        assert!(lookup("nonexistent").is_none());
    }

    #[test]
    fn catalog_ids_are_unique() {
        let mut ids: Vec<&str> = CATALOG.iter().map(|e| e.id).collect();
        ids.sort();
        ids.dedup();
        assert_eq!(ids.len(), CATALOG.len(), "catalog ids must be unique");
    }
}
