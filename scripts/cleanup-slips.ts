import { supabase } from "../server/config/supabase";

async function cleanupSlips() {
  console.log("🧹 Starting cleanup of slip images...");
  
  // 1. Fetch all payments
  const { data: payments, error: fetchErr } = await supabase
    .from("payments")
    .select("id, slip_url, amount, bill_id");
    
  if (fetchErr) {
    console.error("Error fetching payments:", fetchErr);
    return;
  }
  
  console.log(`🔍 Found ${payments.length} payments in total.`);
  
  const imageIdsToDelete: string[] = [];
  const paymentsToUpdate: string[] = [];
  
  for (const p of payments) {
    if (p.slip_url && p.slip_url.startsWith("/api/images/")) {
      const imgId = p.slip_url.replace("/api/images/", "");
      imageIdsToDelete.push(imgId);
      paymentsToUpdate.push(p.id);
    }
  }
  
  console.log(`📸 Found ${imageIdsToDelete.length} slip images to delete.`);
  
  if (imageIdsToDelete.length > 0) {
    // 2. Delete rows in 'images' table
    const { error: imgDelErr } = await supabase
      .from("images")
      .delete()
      .in("id", imageIdsToDelete);
      
    if (imgDelErr) {
      console.error("Error deleting slip images:", imgDelErr);
      return;
    }
    console.log(`✅ Deleted ${imageIdsToDelete.length} rows from 'images' table.`);
    
    // 3. Update 'slip_url' to empty string in 'payments' table
    const { error: payUpdErr } = await supabase
      .from("payments")
      .update({ slip_url: "deleted" }) // mark as deleted so frontend knows it was deleted but still paid
      .in("id", paymentsToUpdate);
      
    if (payUpdErr) {
      console.error("Error updating payments table:", payUpdErr);
      return;
    }
    console.log(`✅ Updated ${paymentsToUpdate.length} payment records (slip_url set to 'deleted').`);
  } else {
    console.log("ℹ️ No slip images found to delete.");
  }
  
  console.log("🎉 Cleanup completed successfully!");
}

cleanupSlips();
