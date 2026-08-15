import { supabase } from "../server/config/supabase";

async function cleanupSlips() {
  console.log("🧹 Running slip cleanup to set empty string...");
  
  // Update all payments where slip_url is 'deleted' to be empty string ''
  const { error: updErr } = await supabase
    .from("payments")
    .update({ slip_url: "" })
    .eq("slip_url", "deleted");
    
  if (updErr) {
    console.error("Error updating payments:", updErr);
    return;
  }
  
  console.log("✅ Successfully updated all 'deleted' slip_urls to empty string!");
}

cleanupSlips();
