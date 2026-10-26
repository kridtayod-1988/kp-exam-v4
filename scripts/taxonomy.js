// scripts/taxonomy.mjs

export const TAXONOMY = [

  { code:'GEN', parent:null, level:1, th:'วิชาความสามารถในการคิดวิเคราะห์', en:'General Aptitude' },

  { code:'GEN.MATH', parent:'GEN', level:2, th:'คิดวิเคราะห์เชิงปริมาณ', en:'Quantitative' },

  { code:'GEN.MATH.SERIES',  parent:'GEN.MATH', level:3, th:'อนุกรม / เลขเรียงลำดับ' },

  { code:'GEN.MATH.WORD',    parent:'GEN.MATH', level:3, th:'โจทย์คณิตศาสตร์ทั่วไป' },

  { code:'GEN.MATH.DATA',    parent:'GEN.MATH', level:3, th:'การวิเคราะห์ข้อมูลจากตาราง/กราฟ' },

  { code:'GEN.MATH.GEOM',    parent:'GEN.MATH', level:3, th:'เรขาคณิต / พื้นที่ / ปริมาตร' },

  { code:'GEN.MATH.PROB',    parent:'GEN.MATH', level:3, th:'ความน่าจะเป็น / สถิติเบื้องต้น' },

  { code:'GEN.LOGIC', parent:'GEN', level:2, th:'คิดวิเคราะห์เชิงเหตุผล', en:'Logical Reasoning' },

  { code:'GEN.LOGIC.SYMBOL', parent:'GEN.LOGIC', level:3, th:'เงื่อนไขสัญลักษณ์' },

  { code:'GEN.LOGIC.VERBAL', parent:'GEN.LOGIC', level:3, th:'เงื่อนไขภาษา / ตรรกศาสตร์' },

  { code:'GEN.LOGIC.SERIES', parent:'GEN.LOGIC', level:3, th:'อุปมาอุปไมย / ความสัมพันธ์' },

  { code:'GEN.THAI', parent:'GEN', level:2, th:'คิดวิเคราะห์เชิงภาษา', en:'Thai Language' },

  { code:'GEN.THAI.READ',    parent:'GEN.THAI', level:3, th:'บทความสั้น / บทความยาว' },

  { code:'GEN.THAI.ORDER',   parent:'GEN.THAI', level:3, th:'การเรียงลำดับข้อความ' },

  { code:'GEN.THAI.WORD',    parent:'GEN.THAI', level:3, th:'การเลือกใช้คำ / เติมคำ' },

  { code:'GEN.THAI.ERROR',   parent:'GEN.THAI', level:3, th:'การสะกดคำ / ประโยคบกพร่อง' },

  { code:'ENG', parent:null, level:1, th:'ภาษาอังกฤษ', en:'English' },

  { code:'ENG.CONV',  parent:'ENG', level:2, th:'Conversation' },

  { code:'ENG.VOCAB', parent:'ENG', level:2, th:'Vocabulary' },

  { code:'ENG.GRAM',  parent:'ENG', level:2, th:'Structure & Grammar' },

  { code:'ENG.READ',  parent:'ENG', level:2, th:'Reading Comprehension' },

  { code:'CIV', parent:null, level:1, th:'ความรู้และลักษณะการเป็นข้าราชการที่ดี', en:'Civil Service' },

  { code:'CIV.ADMIN', parent:'CIV', level:2, th:'ระเบียบบริหารราชการแผ่นดิน' },

  { code:'CIV.PERSON',parent:'CIV', level:2, th:'ระเบียบข้าราชการพลเรือน' },

  { code:'CIV.GOVD',  parent:'CIV', level:2, th:'การบริหารกิจการบ้านเมืองที่ดี' },

  { code:'CIV.PROC',  parent:'CIV', level:2, th:'วิธีปฏิบัติราชการทางปกครอง' },

  { code:'CIV.TORT',  parent:'CIV', level:2, th:'ความรับผิดทางละเมิดของเจ้าหน้าที่' },

  { code:'CIV.ETHIC', parent:'CIV', level:2, th:'มาตรฐานทางจริยธรรม / วินัย' },

];


// กฎจำแนก: [regex, code, น้ำหนัก]

export const RULES = [

  [/อนุกรม|ลำดับถัดไป|จำนวนถัดไป|\?\s*$/u, 'GEN.MATH.SERIES', 3],

  [/ตาราง|กราฟ|แผนภูมิ|ร้อยละของ.*ปี|จากข้อมูลข้างต้น/u, 'GEN.MATH.DATA', 3],

  [/ร้อยละ|เปอร์เซ็นต์|กำไร|ขาดทุน|ดอกเบี้ย|อัตราส่วน|ความเร็ว|กม\./u, 'GEN.MATH.WORD', 2],

  [/พื้นที่|ปริมาตร|เส้นรอบรูป|สามเหลี่ยม|สี่เหลี่ยม|วงกลม|มุม/u, 'GEN.MATH.GEOM', 3],

  [/ความน่าจะเป็น|ค่าเฉลี่ย|มัธยฐาน|ฐานนิยม|ส่วนเบี่ยงเบน|สุ่มหยิบ/u, 'GEN.MATH.PROB', 3],

  [/เงื่อนไขสัญลักษณ์|[A-Z]\s*[><=≥≤]\s*[A-Z]|สรุปที่ ?1|สรุปที่ ?2/u, 'GEN.LOGIC.SYMBOL', 4],

  [/ทุกคน|บางคน|ไม่มี.*ใด|ข้อสรุป|สมเหตุสมผล/u, 'GEN.LOGIC.VERBAL', 2],

  [/อุปมา|สัมพันธ์กับ|:\s*\S+\s*::/u, 'GEN.LOGIC.SERIES', 3],

  [/จงเรียงลำดับ|เรียงข้อความ|ข้อความต่อไปนี้ให้ถูกต้อง|๑\)|1\)\s*.*2\)\s*.*3\)/u, 'GEN.THAI.ORDER', 4],

  [/บทความ|ผู้เขียน|ใจความสำคัญ|สาระสำคัญ|จุดประสงค์ของผู้เขียน/u, 'GEN.THAI.READ', 3],

  [/เติมคำ|คำใดเหมาะสม|ใช้คำใด|ความหมายของคำ|สำนวน|สุภาษิต/u, 'GEN.THAI.WORD', 3],

  [/สะกดผิด|บกพร่อง|ฟุ่มเฟือย|กำกวม|ใช้ภาษาไม่ถูกต้อง/u, 'GEN.THAI.ERROR', 3],

  [/^(A|B|Man|Woman|Speaker)\s*:|Choose the best response|conversation/iu, 'ENG.CONV', 4],

  [/closest in meaning|synonym|antonym|the word ".*" means/iu, 'ENG.VOCAB', 4],

  [/Read the passage|According to the passage|the passage mainly/iu, 'ENG.READ', 4],

  [/Choose the correct|fill in the blank|grammatically|tense|preposition/iu, 'ENG.GRAM', 3],

  [/บริหารราชการแผ่นดิน|ส่วนกลาง|ส่วนภูมิภาค|ส่วนท้องถิ่น|ปลัดกระทรวง|ผู้ว่าราชการจังหวัด/u, 'CIV.ADMIN', 4],

  [/ข้าราชการพลเรือน|ก\.พ\.|ประเภทตำแหน่ง|วิชาการ|อำนวยการ|บรรจุแต่งตั้ง/u, 'CIV.PERSON', 3],

  [/บ้านเมืองที่ดี|ธรรมาภิบาล|เกิดประโยชน์สุข|คุ้มค่า|ลดขั้นตอน/u, 'CIV.GOVD', 4],

  [/คำสั่งทางปกครอง|วิธีปฏิบัติราชการทางปกครอง|อุทธรณ์|เพิกถอนคำสั่ง|คู่กรณี/u, 'CIV.PROC', 4],

  [/ละเมิด|ชดใช้ค่าสินไหม|จงใจหรือประมาทเลินเล่ออย่างร้ายแรง|ไล่เบี้ย/u, 'CIV.TORT', 4],

  [/จริยธรรม|วินัย|ประมวลจริยธรรม|ผลประโยชน์ทับซ้อน|ซื่อสัตย์สุจริต|ไล่ออก|ปลดออก/u, 'CIV.ETHIC', 3],

];
