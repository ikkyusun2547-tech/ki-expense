import { Document, Image, Page, StyleSheet, Text, View, type Styles } from "@react-pdf/renderer";
import type { MemoData } from "@/lib/pdf/memoData";
import { thaiPdfText } from "@/lib/pdf/thaiText";

// ใบเบิกแบบ "บันทึกภายใน" (FM-50000-02 Rev.02) — A4 แนวตั้ง จัดตามฟอร์มกระดาษจริง
//
// เส้นตาราง: ทุกช่องวาด "เส้นขวาของตัวเอง" และใช้ความกว้างเป็น pt ชุดเดียวกันทุกแถว
// (ไม่ใช้ % ซ้อนกัน — กล่องที่มีเส้นขอบทำให้ % ของลูกเพี้ยนไปเศษ pt เส้นแต่ละแถวจะไม่ตรงกัน)

const LINE = { borderColor: "#000", borderStyle: "solid" as const };
const RIGHT = { ...LINE, borderRightWidth: 1 };

// ขนาดตัวอักษร (pt) — ปรับที่นี่ที่เดียว
const SIZE = { base: 11, title: 18, pageNo: 9.5, company: 11.5, table: 10.5, formCode: 8.5 };
const INDENT = 36;

// ความกว้างคอลัมน์ (pt) — คอลัมน์สุดท้ายของแต่ละแถวยืดเต็มที่เหลือ
const HEAD = { label: 62, value: 250, rightLabel: 50 }; // หัวบันทึก: ซ้าย = label + value
const HEAD_LEFT = HEAD.label + HEAD.value;
const COL = { no: 44, code: 90, user: 134, amount: 80 }; // ตาราง: กำหนดชำระ = ที่เหลือ
const COL_LEFT = COL.no + COL.code + COL.user;

const styles = StyleSheet.create({
  page: { fontFamily: "Sarabun", fontSize: SIZE.base, lineHeight: 1.55, paddingTop: 40, paddingBottom: 30, paddingHorizontal: 46 },
  bold: { fontWeight: "bold" },
  row: { flexDirection: "row" },
  rowLine: { ...LINE, flexDirection: "row", borderTopWidth: 1 },
  grow: { flexGrow: 1, flexBasis: 0 },

  // หัวบันทึก
  header: { ...LINE, borderWidth: 1 },
  headerLeft: { ...RIGHT, width: HEAD_LEFT },
  titleCell: { ...LINE, alignItems: "center", paddingTop: 6, paddingBottom: 4, borderBottomWidth: 1 },
  title: { fontSize: SIZE.title, fontWeight: "bold", lineHeight: 1.2 },
  pageNo: { fontSize: SIZE.pageNo, lineHeight: 1.3 },
  headerRight: { flexGrow: 1, flexBasis: 0, alignItems: "center", justifyContent: "flex-end", paddingHorizontal: 6, paddingTop: 6, paddingBottom: 4 },
  logo: { width: 84, height: 42, marginBottom: 4, objectFit: "contain" },
  company: { fontWeight: "bold", fontSize: SIZE.company },
  cell: { paddingHorizontal: 7, paddingVertical: 3 },

  // เนื้อหา
  body: { ...LINE, borderWidth: 1, marginTop: 16, flexGrow: 1, paddingHorizontal: 28, paddingTop: 28 },
  intro: { textIndent: INDENT },

  table: { ...LINE, borderWidth: 1, marginTop: 10, fontSize: SIZE.table },
  tCell: { paddingVertical: 3.5, paddingHorizontal: 5, textAlign: "center" },

  paragraph: { marginTop: 22, textIndent: INDENT },
  closing: { marginTop: 14, paddingLeft: INDENT },

  // ลายเซ็นอยู่กึ่งกลางหน้ากระดาษ
  signatures: { marginTop: 54, alignItems: "center" },
  // ทุกชุดกว้างเท่ากัน + ช่องคำนำหน้ากว้างเท่ากัน → เส้นลงชื่อของทุกชุดตรงกัน
  signature: { width: 270, alignItems: "center", marginBottom: 38 },
  signLine: { flexDirection: "row", alignSelf: "stretch" },
  signRole: { width: 66, textAlign: "right" },
  approvedNote: { marginTop: 2, fontSize: SIZE.pageNo, color: "#333" },
  formCode: { marginTop: 5, fontSize: SIZE.formCode, color: "#333" },
});

export type MemoLogo = { data: Buffer; format: "png" | "jpg" };

export function InternalMemo({ data, logo }: { data: MemoData; logo: MemoLogo | null }) {
  return (
    <Document title={`บันทึกภายใน ${data.subject} ${data.subjectDetail}`} author={data.company} language="th">
      <Page size="A4" style={styles.page}>
        {/* ---------- หัวบันทึก ---------- */}
        <View style={styles.header}>
          <View style={styles.row}>
            <View style={styles.headerLeft}>
              <View style={styles.titleCell}>
                <T style={styles.title}>บันทึกภายใน</T>
                <T style={styles.pageNo}>หน้า 1 ต่อ จบ</T>
              </View>
              {/* แถววันที่ยืดเต็มความสูงที่เหลือ (ช่องโลโก้ด้านขวาสูงกว่า) เส้นตั้งจึงลากถึงเส้นล่าง */}
              <View style={[styles.row, { flexGrow: 1 }]}>
                <T style={[styles.cell, styles.bold, RIGHT, { width: HEAD.label }]}>วันที่</T>
                <T style={[styles.cell, styles.grow]}>{data.date}</T>
              </View>
            </View>
            <View style={styles.headerRight}>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image ไม่มี alt */}
              {logo && <Image src={logo} style={styles.logo} />}
              <T style={styles.company}>{data.company}</T>
            </View>
          </View>
          <View style={styles.rowLine}>
            <T style={[styles.cell, styles.bold, RIGHT, { width: HEAD.label }]}>เรื่อง</T>
            <View style={[styles.cell, RIGHT, { width: HEAD.value }]}>
              <T>{data.subject}</T>
              <T>{data.subjectDetail}</T>
            </View>
            <T style={[styles.cell, styles.bold, RIGHT, { width: HEAD.rightLabel }]}>จาก</T>
            <T style={[styles.cell, styles.grow]}>{data.from}</T>
          </View>
          <View style={styles.rowLine}>
            <T style={[styles.cell, styles.bold, RIGHT, { width: HEAD.label }]}>เรียน</T>
            <T style={[styles.cell, RIGHT, { width: HEAD.value }]}>{data.to}</T>
            <T style={[styles.cell, styles.bold, RIGHT, { width: HEAD.rightLabel }]}>เพื่อ</T>
            <T style={[styles.cell, styles.grow]}>{data.purpose}</T>
          </View>
        </View>

        {/* ---------- เนื้อหา ---------- */}
        <View style={styles.body}>
          <T style={styles.intro}>{data.intro}</T>

          <View style={styles.table}>
            {/* หัวตาราง 2 ชั้น: [ชื่อตาราง / ลำดับ รหัสลูกค้า ผู้ใช้บริการ] [จำนวน] [เดือน / กำหนดชำระ] */}
            <View style={styles.row}>
              <View style={{ width: COL_LEFT }}>
                <T style={[styles.tCell, styles.bold, RIGHT, { borderBottomWidth: 1 }]}>{data.tableTitle}</T>
                <View style={styles.row}>
                  <T style={[styles.tCell, styles.bold, RIGHT, { width: COL.no }]}>ลำดับ</T>
                  <T style={[styles.tCell, styles.bold, RIGHT, { width: COL.code }]}>รหัสลูกค้า</T>
                  <T style={[styles.tCell, styles.bold, RIGHT, { width: COL.user }]}>ผู้ใช้บริการ</T>
                </View>
              </View>
              <View style={[styles.tCell, RIGHT, { width: COL.amount, justifyContent: "flex-end" }]}>
                <T style={styles.bold}>จำนวน</T>
              </View>
              <View style={styles.grow}>
                <T style={[styles.tCell, styles.bold, { ...LINE, borderBottomWidth: 1 }]}>{data.monthHeader}</T>
                <T style={[styles.tCell, styles.bold]}>กำหนดชำระ</T>
              </View>
            </View>

            {data.rows.map((r) => (
              <View key={r.no} style={styles.rowLine}>
                <T style={[styles.tCell, RIGHT, { width: COL.no }]}>{String(r.no)}</T>
                <T style={[styles.tCell, RIGHT, { width: COL.code }]}>{r.customerCode}</T>
                <T style={[styles.tCell, RIGHT, { width: COL.user }]}>{r.serviceUser}</T>
                <T style={[styles.tCell, RIGHT, { width: COL.amount }]}>{r.amount}</T>
                <T style={[styles.tCell, styles.grow]}>{r.dueDate}</T>
              </View>
            ))}

            <View style={styles.rowLine}>
              <T style={[styles.tCell, styles.bold, RIGHT, { width: COL_LEFT }]}>รวม</T>
              <T style={[styles.tCell, styles.bold, styles.grow]}>{data.total}</T>
            </View>
          </View>

          <Text style={styles.paragraph}>
            {thaiPdfText(data.bodyLead)}
            <Text style={styles.bold}>{thaiPdfText(data.bodyBold)}</Text>
            {thaiPdfText(data.bodyTail)}
          </Text>

          <T style={styles.closing}>{data.closing}</T>

          <View style={styles.signatures}>
            <Signature role="ผู้ขออนุมัติ" person={data.requester} />
            <Signature role="ผู้อนุมัติ" person={data.approver} note={data.approvedNote} />
          </View>
        </View>

        <T style={styles.formCode}>{data.formCode}</T>
      </Page>
    </Document>
  );
}

const DOTS = "..................................................";

// ชื่อ/ตำแหน่งว่าง (ยังไม่เลือกผู้อนุมัติ) → จุดไข่ปลาให้เขียนมือ; note = เวลาที่อนุมัติในระบบ
function Signature({ role, person, note }: { role: string; person: { name: string; title: string }; note?: string | null }) {
  return (
    <View style={styles.signature}>
      <View style={styles.signLine}>
        <T style={styles.signRole}>{role}</T>
        <T>{DOTS}</T>
      </View>
      <T>{`(${person.name || DOTS})`}</T>
      <T>{person.title || DOTS}</T>
      {note && <T style={styles.approvedNote}>{note}</T>}
    </View>
  );
}

// ข้อความภาษาไทยทุกจุดต้องผ่าน thaiPdfText (แก้ปัญหาสระอำใน react-pdf) — ใช้ T แทน Text
function T({ style, children }: { style?: Styles[string] | Styles[string][]; children: string }) {
  return <Text style={style}>{thaiPdfText(children)}</Text>;
}
