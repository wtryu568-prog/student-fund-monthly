const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, ".env") });

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || "";

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in process.env");
  process.exit(1);
}

console.log("Using Supabase URL:", supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseKey);
run(supabase);

async function run(supabase) {
  console.log("Fetching images count from database...");
  const { data: images, error } = await supabase
    .from("images")
    .select("id, base64");

  if (error) {
    console.error("Error:", error);
    return;
  }

  let base64Count = 0;
  let driveCount = 0;

  images.forEach(img => {
    if (img.base64 && img.base64.startsWith("google_drive:")) {
      driveCount++;
    } else if (img.base64) {
      base64Count++;
    }
  });

  console.log(`Total images in Supabase database: ${images.length}`);
  console.log(`- Stored as base64 in Supabase: ${base64Count}`);
  console.log(`- Stored as Google Drive references: ${driveCount}`);

  console.log("\nFetching treasurers list...");
  const { data: treasurers, error: uError } = await supabase
    .from("users")
    .select("id, full_name, role")
    .eq("role", "treasurer");
    
  if (uError) {
    console.error("User fetch error:", uError);
  } else {
    console.log("Treasurers found:", treasurers);
  }
}
