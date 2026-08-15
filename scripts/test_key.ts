import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
if (privateKey) {
  const formattedKey = privateKey.replace(/\\n/g, "\n");
  
  // Try to fix the duplicate segment in Line 17
  const corruptedSegment = "WattsX1+BEqgYWyrfDUfQi7KZeh0";
  const fixedKey = formattedKey.replace(corruptedSegment, "");
  
  console.log("=== FIXED KEY ===");
  console.log(fixedKey);
  console.log("=================");
  
  try {
    const key = crypto.createPrivateKey(fixedKey);
    console.log("✅ FIXED key load success!");
  } catch (err: any) {
    console.error("❌ FIXED key load failed:", err.message);
  }
}
