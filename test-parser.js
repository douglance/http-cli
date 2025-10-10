import { readFileSync } from "node:fs";
import { httpParser } from "./dist/parsers/http-parser.js";

const content = readFileSync("/Users/douglance/.http-inspector/requests.http", "utf-8");

console.log("First 200 chars of file:");
console.log(content.substring(0, 200));
console.log("\n---\n");

console.log("Parsing file...\n");
const result = httpParser.parse(content);

console.log(`Found ${result.requests.length} requests:\n`);
result.requests.forEach((req, idx) => {
  console.log(
    `${idx + 1}. ${req.method.padEnd(6)} ${req.name.padEnd(40)} URL: ${req.url.substring(0, 50)}`
  );
});
