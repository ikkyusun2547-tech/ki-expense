import "server-only";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Font, renderToBuffer } from "@react-pdf/renderer";
import type { MemoData } from "@/lib/pdf/memoData";
import { InternalMemo, type MemoLogo } from "@/pdf/InternalMemo";

// ฝังฟอนต์ Sarabun (OFL) จาก src/pdf/fonts — มีตาราง GPOS ทำให้สระ/วรรณยุกต์ซ้อนวางถูกตำแหน่ง
let fontsRegistered = false;

function registerFonts() {
  if (fontsRegistered) return;
  const dir = path.join(process.cwd(), "src", "pdf", "fonts");
  Font.register({
    family: "Sarabun",
    fonts: [
      { src: path.join(dir, "Sarabun-Regular.ttf") },
      { src: path.join(dir, "Sarabun-Bold.ttf"), fontWeight: "bold" },
    ],
  });
  // ไม่ตัดคำด้วยขีด (react-pdf ใส่ "-" ทุกจุดที่ตัดกลางคำ ใช้กับภาษาไทยไม่ได้) — ขึ้นบรรทัดใหม่ที่ช่องว่างเท่านั้น
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

// โลโก้บริษัท: วางไฟล์ไว้ที่ src/pdf/assets/logo.png (หรือ .jpg) — ไม่มีไฟล์ก็พิมพ์ได้ (มีแค่ชื่อบริษัท)
// ส่งเป็นเนื้อไฟล์ ไม่ใช่ path — react-pdf อ่าน path แบบ Windows (C:\...) ไม่ได้และไม่แจ้ง error
function loadLogo(): MemoLogo | null {
  const dir = path.join(process.cwd(), "src", "pdf", "assets");
  for (const [name, format] of [["logo.png", "png"], ["logo.jpg", "jpg"], ["logo.jpeg", "jpg"]] as const) {
    const file = path.join(dir, name);
    if (existsSync(file)) return { data: readFileSync(file), format };
  }
  return null;
}

// preview = ตัวอย่างจากฟอร์มก่อนบันทึก (มีลายน้ำ)
export async function renderInternalMemo(data: MemoData, { preview = false }: { preview?: boolean } = {}): Promise<Buffer> {
  registerFonts();
  return renderToBuffer(<InternalMemo data={data} logo={loadLogo()} preview={preview} />);
}
