import dotenv from "dotenv";
dotenv.config();

import { getAccessToken, getOrCreateFolder, uploadFile } from "../server/services/googleDriveService";
import { ENV } from "../server/config/env";

async function testUpload() {
  console.log("🚀 Testing Google Drive authentication and upload...");
  try {
    const token = await getAccessToken();
    console.log("✅ Authenticated successfully! Token obtained:", token.substring(0, 15) + "...");
    
    const rootFolderId = ENV.GOOGLE_DRIVE_ROOT_FOLDER_LINK ? ENV.GOOGLE_DRIVE_ROOT_FOLDER_LINK.match(/\/folders\/([a-zA-Z0-9_-]+)/)?.[1] : null;
    console.log("Root Folder ID:", rootFolderId);
    
    if (!rootFolderId) {
      console.error("❌ Root Folder ID is not configured correctly in .env");
      return;
    }
    
    console.log("Testing folder resolution...");
    const targetFolderId = await getOrCreateFolder(["ค่าบำรุงรายเดือน", "ปี พ.ศ. 2569", "เดือน 07"], rootFolderId);
    console.log("✅ Resolved Folder ID:", targetFolderId);
    
    console.log("Testing test file upload...");
    const testBase64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
    const uploadResult = await uploadFile(testBase64, "test_connection.jpg", targetFolderId);
    console.log("✅ Upload success! File ID:", uploadResult.id);
    console.log("🎉 All tests passed successfully!");
  } catch (err: any) {
    console.error("❌ Test failed:", err);
  }
}

testUpload();
