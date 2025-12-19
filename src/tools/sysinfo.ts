import * as os from 'os';

/**
 * Displays the current memory usage of the system.
 */
function getMemoryUsage(): void {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsagePercentage = (usedMemory / totalMemory) * 100;

  console.log('--- Memory Usage ---');
  console.log(`Total Memory: ${(totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB`);
  console.log(`Used Memory: ${(usedMemory / 1024 / 1024 / 1024).toFixed(2)} GB`);
  console.log(`Free Memory: ${(freeMemory / 1024 / 1024 / 1024).toFixed(2)} GB`);
  console.log(`Usage: ${memoryUsagePercentage.toFixed(2)}%`);
  console.log('');
}

/**
 * Displays information about the CPU cores.
 */
function getCpuInfo(): void {
  const cpus = os.cpus();

  console.log('--- CPU Information ---');
  console.log(`Logical Cores: ${cpus.length}`);
  cpus.forEach((cpu, index) => {
    console.log(`Core ${index + 1}:`);
    console.log(`  Model: ${cpu.model}`);
    console.log(`  Speed: ${cpu.speed} MHz`);
  });
}

try {
  getMemoryUsage();
  getCpuInfo();
} catch (error) {
  console.error("Failed to retrieve system information:", error);
}