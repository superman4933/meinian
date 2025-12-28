import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

export async function GET() {
  try {
    const filePath = join(process.cwd(), "public", "city.txt");
    const fileContent = await readFile(filePath, "utf-8");
    const cities = fileContent
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    
    return NextResponse.json({ cities });
  } catch (error) {
    console.error("Error reading cities file:", error);
    return NextResponse.json(
      { error: "Failed to read cities file" },
      { status: 500 }
    );
  }
}

