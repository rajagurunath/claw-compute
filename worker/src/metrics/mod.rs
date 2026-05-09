use sysinfo::System;

pub struct Sampler {
    sys: System,
}

impl Sampler {
    pub fn new() -> Self {
        let mut sys = System::new_all();
        sys.refresh_all();
        Self { sys }
    }

    pub fn sample(&mut self) -> Sample {
        self.sys.refresh_cpu_all();
        self.sys.refresh_memory();
        let cpu_pct = self.sys.global_cpu_usage() as f64;
        let mem_used = self.sys.used_memory() as f64;
        let mem_total = self.sys.total_memory() as f64;
        let mem_pct = if mem_total > 0.0 {
            mem_used / mem_total * 100.0
        } else {
            0.0
        };
        let free_ram_gb = (self.sys.available_memory() as f64) / 1024.0 / 1024.0 / 1024.0;
        Sample {
            cpu_pct,
            mem_pct,
            free_ram_gb,
        }
    }
}

impl Default for Sampler {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Clone, Copy, Debug)]
pub struct Sample {
    pub cpu_pct: f64,
    pub mem_pct: f64,
    pub free_ram_gb: f64,
}
