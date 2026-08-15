import dotenv from "dotenv";
dotenv.config();

const url = process.env.SUPABASE_URL || "https://kukmfozdhborrnsecflr.supabase.co";

async function run() {
  try {
    const res = await fetch(url);
    console.log("Status:", res.status);
    console.log("Status text:", res.statusText);
    const text = await res.text();
    console.log("Body:", text);
  } catch (err: any) {
    console.error("Fetch error:", err.message);
  }
}

run();
