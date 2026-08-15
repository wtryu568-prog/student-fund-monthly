import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const url = process.env.SUPABASE_URL || "";
const key = process.env.SUPABASE_SERVICE_KEY || "";

console.log("URL:", url);
console.log("Key starts with:", key.substring(0, 15) + "...");

const supabase = createClient(url, key);

async function test() {
  try {
    const { data, error } = await supabase.from("users").select("id").limit(1);
    if (error) {
      console.error("Supabase returned error:", error);
    } else {
      console.log("Success! Data:", data);
    }
  } catch (err: any) {
    console.error("Thrown exception:", err.message);
  }
}

test();
