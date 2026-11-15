import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { fetchPsiDetail, fetchPsiIndex, getPsiApiConfig } from "../src/lib/psi/psi-api.ts";
import { filterPsiArea, latestPsiRecords, mergePsiDetail } from "../src/lib/psi/records.ts";

const config = getPsiApiConfig();
const list = filterPsiArea(latestPsiRecords(await fetchPsiIndex(config, "", AbortSignal.timeout(6000))), "combustion");
if (!list.length) throw new Error("El catálogo de combustión está vacío. Se conserva el snapshot anterior.");

const investigations = [];
const retry = [];
let details = 0;
for (let start = 0; start < list.length; start += 4) {
  const batch = await Promise.all(list.slice(start, start + 4).map(async (record) => {
    try {
      const { investigation } = await fetchPsiDetail(config, record.accession, AbortSignal.timeout(6000));
      details += 1;
      return mergePsiDetail(record, investigation);
    } catch (error) {
      if (error.name === "TimeoutError") retry.push(record);
      else console.warn(`${record.accession}: ${error.name}; se conserva su registro de listado.`);
      return record;
    }
  }));
  investigations.push(...batch);
}
for (let start = 0; start < retry.length; start += 4) {
  await Promise.all(retry.slice(start, start + 4).map(async (record) => {
    try {
      const { investigation } = await fetchPsiDetail(config, record.accession, AbortSignal.timeout(6000));
      investigations[investigations.indexOf(record)] = mergePsiDetail(record, investigation);
      details += 1;
    } catch (error) {
      console.warn(`${record.accession}: ${error.name}; se conserva su registro de listado.`);
    }
  }));
}

const directory = new URL("../data/", import.meta.url);
const output = new URL("psi-snapshot.json", directory);
const temporary = new URL(`psi-snapshot-${randomUUID()}.tmp`, directory);
await mkdir(directory, { recursive: true });
try {
  await writeFile(temporary, JSON.stringify({ generatedAt: new Date().toISOString(), investigations }, null, 2) + "\n");
  await rename(temporary, output);
} finally {
  await rm(temporary, { force: true });
}
console.log(`Snapshot: ${investigations.length} investigaciones, ${details} fichas enriquecidas. Sin archivos experimentales.`);
