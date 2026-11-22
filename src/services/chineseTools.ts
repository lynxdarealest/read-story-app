import { pinyin } from 'pinyin-pro';
import { getHanviet, hanvietData } from 'hanviet-pinyin-words';
import { sify, tify } from 'chinese-conv';
import { DictionaryEntry } from '../types';

const CJK_REGEX = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

export function containsCjk(text: string): boolean {
  return CJK_REGEX.test(text);
}

/**
 * Normalize Vietnamese / Latin string for alignment matching
 */
function normalizeMatchToken(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFC')
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

/**
 * Common Western / Anime / Light-Novel Chinese transliterations -> English Name
 */
const WESTERN_NAME_MAP: Record<string, string> = {
  亚瑟: 'Arthur',
  爱丽丝: 'Alice',
  艾丽丝: 'Alice',
  艾莉丝: 'Alice',
  克莱恩: 'Klein',
  艾伦: 'Allen',
  阿伦: 'Alan',
  路飞: 'Luffy',
  索隆: 'Zoro',
  山治: 'Sanji',
  娜美: 'Nami',
  罗宾: 'Robin',
  威廉: 'William',
  查理: 'Charlie',
  查尔斯: 'Charles',
  杰克: 'Jack',
  汤姆: 'Tom',
  托马斯: 'Thomas',
  玛丽: 'Mary',
  露西: 'Lucy',
  凯瑟琳: 'Catherine',
  安娜: 'Anna',
  米娅: 'Mia',
  诺亚: 'Noah',
  莱恩: 'Ryan',
  瑞安: 'Ryan',
  塞巴斯蒂安: 'Sebastian',
  赫敏: 'Hermione',
  哈利: 'Harry',
  罗恩: 'Ron',
  伊丽莎白: 'Elizabeth',
  维多利亚: 'Victoria',
  奥利弗: 'Oliver',
  奥莉薇亚: 'Olivia',
  莉莉: 'Lily',
  艾米丽: 'Emily',
  艾玛: 'Emma',
  索菲亚: 'Sophia',
  苏菲: 'Sophie',
  夏洛特: 'Charlotte',
  夏洛克: 'Sherlock',
  约翰: 'John',
  约瑟夫: 'Joseph',
  大卫: 'David',
  迈克尔: 'Michael',
  丹尼尔: 'Daniel',
  詹姆斯: 'James',
  罗伯特: 'Robert',
  理查德: 'Richard',
  爱德华: 'Edward',
  亨利: 'Henry',
  乔治: 'George',
  亚历山大: 'Alexander',
  卢卡斯: 'Lucas',
  里昂: 'Leon',
  雷恩: 'Rein',
  莱昂: 'Leon',
  卡尔: 'Carl',
  凯文: 'Kevin',
  布莱恩: 'Brian',
  史蒂夫: 'Steve',
  彼得: 'Peter',
  保罗: 'Paul',
  马克: 'Mark',
  马修: 'Matthew',
  安德鲁: 'Andrew',
  尼古拉斯: 'Nicholas',
  埃里克: 'Eric',
  弗兰克: 'Frank',
  菲利普: 'Philip',
  斯蒂芬: 'Stephen',
  克里斯: 'Chris',
  克里斯蒂安: 'Christian',
  格蕾丝: 'Grace',
  克洛伊: 'Chloe',
  海伦: 'Helen',
  莎拉: 'Sarah',
  瑞秋: 'Rachel',
  劳拉: 'Laura',
  汉娜: 'Hannah',
  佐伊: 'Zoe',
  伊娃: 'Eva',
  伊芙: 'Eve',
  贝拉: 'Bella',
  玫瑰: 'Rose',
  卡卡西: 'Kakashi',
  鸣人: 'Naruto',
  佐助: 'Sasuke',
  五条悟: 'Gojo Satoru',
  五条: 'Gojo',
  炭治郎: 'Tanjiro',
  祢豆子: 'Nezuko',
  利威尔: 'Levi',
  三笠: 'Mikasa',
  阿明: 'Armin',
  夜神月: 'Light Yagami',
  亚丝娜: 'Asuna',
  桐人: 'Kirito',
  蕾姆: 'Rem',
  拉姆: 'Ram',
  艾米莉亚: 'Emilia',
  爱蜜莉雅: 'Emilia',
  莱茵哈鲁特: 'Reinhard',
  奥黛丽: 'Audrey',
  阿尔杰: 'Alger',
  戴里克: 'Derrick',
  佛尔思: 'Fors',
  休: 'Xio',
  伦纳德: 'Leonard',
  埃姆林: 'Emlyn',
  嘉德丽雅: 'Cattleya',
  阿蒙: 'Amon',
  亚当: 'Adam',
  罗塞尔: 'Roselle',
  梅林: 'Merlin',
  兰斯洛特: 'Lancelot',
  高文: 'Gawain',
  莫德雷德: 'Mordred',
  加拉哈德: 'Galahad',
  阿波罗: 'Apollo',
  宙斯: 'Zeus',
  雅典娜: 'Athena',
  赫拉: 'Hera',
  波塞冬: 'Poseidon',
  哈迪斯: 'Hades',
  阿瑞斯: 'Ares',
  路西法: 'Lucifer',
  加百列: 'Gabriel',
  拉斐尔: 'Raphael',
  米迦勒: 'Michael',
  乌列尔: 'Uriel',
  撒旦: 'Satan',
  德古拉: 'Dracula',
  福尔摩斯: 'Holmes',
  华生: 'Watson',
  莫里亚蒂: 'Moriarty',
  先生: 'Mr.',
  小姐: 'Miss',
  夫人: 'Mrs.',
  博士: 'Dr.',
  教授: 'Prof.',
  公爵: 'Duke',
  伯爵: 'Count',
  子爵: 'Viscount',
  男爵: 'Baron',
  国王: 'King',
  王后: 'Queen',
  王子: 'Prince',
  公主: 'Princess',
  骑士: 'Knight',
  法师: 'Mage',
  魔法师: 'Wizard',
  魔王: 'Demon Lord',
  勇者: 'Hero',
};

/**
 * Common Chinese character -> Vietnamese glosses for phrase alignment
 */
const COMMON_CHAR_GLOSSES: Record<string, string[]> = {
  的: ['của'],
  有: ['có', 'hữu'],
  没: ['không', 'chưa', 'một'],
  不: ['không', 'bất', 'chẳng'],
  无: ['không', 'vô'],
  非: ['không', 'phi'],
  是: ['là', 'thị', 'đúng'],
  在: ['ở', 'tại', 'đang'],
  了: ['rồi', 'đã'],
  着: ['đang', 'lấy', 'trước'],
  过: ['qua', 'từng', 'quá'],
  人: ['người', 'nhân'],
  他: ['hắn', 'anh', 'y', 'gã', 'tha'],
  她: ['nàng', 'cô', 'chị'],
  它: ['nó'],
  我: ['ta', 'tôi', 'mình', 'ngã'],
  你: ['ngươi', 'bạn', 'anh', 'cậu', 'nhĩ'],
  您: ['ngài', 'ông', 'bà'],
  们: ['các', 'bọn', 'chúng'],
  说: ['nói', 'thuyết'],
  道: ['nói', 'đạo', 'đường', 'biết'],
  问: ['hỏi', 'vấn'],
  答: ['đáp', 'trả'],
  看: ['nhìn', 'xem', 'thấy', 'khán'],
  见: ['thấy', 'gặp', 'kiến'],
  听: ['nghe', 'thính'],
  想: ['nghĩ', 'muốn', 'nhớ', 'tưởng'],
  思: ['nghĩ', 'nhớ', 'tư'],
  好: ['tốt', 'được', 'hảo', 'hay'],
  大: ['lớn', 'to', 'đại'],
  小: ['nhỏ', 'bé', 'tiểu'],
  多: ['nhiều', 'đa'],
  少: ['ít', 'thiếu', 'trẻ'],
  高: ['cao'],
  矮: ['lùn', 'thấp'],
  长: ['dài', 'trưởng', 'trường'],
  短: ['ngắn', 'đoản'],
  新: ['mới', 'tân'],
  旧: ['cũ', 'cựu'],
  古: ['cổ', 'xưa'],
  老: ['già', 'lão', 'cũ'],
  真: ['thật', 'chân'],
  假: ['giả'],
  美: ['đẹp', 'mỹ'],
  丑: ['xấu', 'sửu'],
  香: ['thơm', 'hương'],
  冷: ['lạnh', 'lãnh'],
  寒: ['lạnh', 'hàn'],
  热: ['nóng', 'nhiệt'],
  轻: ['nhẹ', 'khinh'],
  重: ['nặng', 'trọng'],
  快: ['nhanh', 'mau', 'khoái'],
  慢: ['chậm', 'mạn'],
  强: ['mạnh', 'cường'],
  弱: ['yếu', 'nhược'],
  上: ['trên', 'lên', 'thượng'],
  下: ['dưới', 'xuống', 'hạ'],
  左: ['trái', 'tả'],
  右: ['phải', 'hữu'],
  前: ['trước', 'tiền'],
  后: ['sau', 'hậu'],
  里: ['dặm', 'trong', 'lý', 'làng'],
  外: ['ngoài', 'ngoại'],
  内: ['trong', 'nội'],
  中: ['trong', 'giữa', 'trung'],
  间: ['giữa', 'gian', 'phòng'],
  旁: ['bên', 'cạnh', 'bàng'],
  边: ['bên', 'cạnh', 'biên'],
  东: ['đông'],
  西: ['tây'],
  南: ['nam'],
  北: ['bắc'],
  和: ['và', 'cùng', 'hòa'],
  与: ['cùng', 'và', 'với', 'dữ'],
  跟: ['cùng', 'với', 'theo'],
  也: ['cũng', 'dã'],
  都: ['đều', 'đô'],
  就: ['liền', 'thì', 'tựu'],
  便: ['liền', 'tiện'],
  被: ['bị', 'được', 'bị'],
  把: ['đem', 'lấy', 'bắt'],
  将: ['đem', 'sẽ', 'tướng'],
  让: ['khiến', 'để', 'nhượng'],
  叫: ['gọi', 'kêu', 'khiến', 'khiếu'],
  喊: ['hét', 'hô', 'hảm'],
  给: ['cho', 'đưa', 'cấp'],
  送: ['tặng', 'đưa', 'tiễn', 'tống'],
  拿: ['lấy', 'cầm', 'nã'],
  带: ['mang', 'đem', 'đới'],
  到: ['đến', 'tới', 'đáo'],
  去: ['đi', 'khứ'],
  来: ['đến', 'lại', 'tới', 'lai'],
  回: ['về', 'lại', 'hồi'],
  出: ['ra', 'xuất'],
  进: ['vào', 'tiến'],
  入: ['vào', 'nhập'],
  起: ['lên', 'dậy', 'khởi'],
  开: ['mở', 'khai'],
  关: ['đóng', 'tắt', 'quan'],
  站: ['đứng', 'trạm'],
  坐: ['ngồi', 'tọa'],
  躺: ['nằm'],
  走: ['đi', 'tẩu'],
  跑: ['chạy', 'bào'],
  飞: ['bay', 'phi'],
  跳: ['nhảy', 'khiêu'],
  笑: ['cười', 'tiếu'],
  哭: ['khóc', 'khốc'],
  惊: ['kinh', 'giật', 'hoảng'],
  怕: ['sợ', 'phạ'],
  怒: ['giận', 'nộ'],
  爱: ['yêu', 'ái'],
  恨: ['hận', 'ghét'],
  死: ['chết', 'tử'],
  活: ['sống', 'hoạt'],
  生: ['sống', 'sinh'],
  杀: ['giết', 'sát'],
  打: ['đánh', 'đả'],
  吃: ['ăn', 'ngật'],
  喝: ['uống', 'hát'],
  睡: ['ngủ', 'thụy'],
  穿: ['mặc', 'xuyên'],
  脱: ['cởi', 'thoát'],
  个: ['cái', 'người', 'một'],
  这: ['này', 'đây'],
  那: ['kia', 'đó'],
  哪: ['nào', 'đâu'],
  谁: ['ai', 'thùy'],
  什: ['gì', 'cái'],
  么: ['gì', 'sao'],
  为: ['vì', 'làm', 'vi'],
  可: ['có', 'thể', 'khả'],
  能: ['thể', 'năng'],
  读: ['đọc', 'độc'],
  者: ['người', 'giả'],
  会: ['sẽ', 'biết', 'hội'],
  要: ['muốn', 'cần', 'phải', 'yếu'],
  只: ['chỉ', 'chích'],
  还: ['còn', 'vẫn', 'hoàn'],
  很: ['rất', 'ngận'],
  太: ['quá', 'thái'],
  最: ['nhất', 'tối'],
  更: ['càng', 'hơn', 'canh'],
  才: ['mới', 'tài'],
  又: ['lại', 'hựu'],
  却: ['lại', 'nhưng', 'khước'],
  但: ['nhưng', 'đãn'],
  而: ['mà', 'nhưng', 'nhi'],
  因: ['vì', 'bởi', 'nhân'],
  所: ['nên', 'nơi', 'sở'],
  以: ['để', 'lấy', 'dĩ'],
  如: ['như', 'nếu'],
  果: ['quả', 'nếu'],
  虽: ['tuy', 'dù'],
  然: ['nhiên', 'vậy'],
  时: ['lúc', 'khi', 'thời'],
  候: ['lúc', 'khi', 'hậu'],
  年: ['năm', 'niên'],
  月: ['tháng', 'trăng', 'nguyệt'],
  日: ['ngày', 'mặt', 'nhật'],
  天: ['ngày', 'trời', 'thiên'],
  地: ['đất', 'địa'],
  夜: ['đêm', 'dạ'],
  早: ['sớm', 'tảo'],
  晚: ['tối', 'muộn', 'vãn'],
  春: ['xuân'],
  夏: ['hạ', 'hè'],
  秋: ['thu'],
  冬: ['đông'],
  // Nature, geography & units
  江: ['sông', 'giang'],
  河: ['sông', 'hà'],
  川: ['sông', 'xuyên'],
  溪: ['suối', 'khê'],
  湖: ['hồ'],
  海: ['biển', 'hải'],
  水: ['nước', 'thủy'],
  波: ['sóng', 'ba'],
  浪: ['sóng', 'lãng'],
  山: ['núi', 'sơn'],
  峰: ['đỉnh', 'phong'],
  岭: ['đèo', 'núi', 'lĩnh'],
  谷: ['thung', 'lũng', 'cốc'],
  林: ['rừng', 'lâm'],
  森: ['rừng', 'sâm'],
  树: ['cây', 'thụ'],
  木: ['cây', 'gỗ', 'mộc'],
  花: ['hoa'],
  草: ['cỏ', 'thảo'],
  叶: ['lá', 'diệp'],
  石: ['đá', 'thạch'],
  岩: ['đá', 'nham'],
  土: ['đất', 'thổ'],
  沙: ['cát', 'sa'],
  风: ['gió', 'phong'],
  雨: ['mưa', 'vũ'],
  雪: ['tuyết'],
  冰: ['băng'],
  霜: ['sương'],
  云: ['mây', 'vân'],
  雾: ['sương', 'vụ'],
  雷: ['sấm', 'lôi'],
  电: ['sét', 'điện'],
  火: ['lửa', 'hỏa'],
  光: ['sáng', 'ánh', 'quang'],
  影: ['bóng', 'ảnh'],
  星: ['sao', 'tinh'],
  阳: ['dương', 'nắng'],
  阴: ['âm', 'râm'],
  // Numbers & measures
  零: ['không', 'linh'],
  一: ['một', 'nhất'],
  二: ['hai', 'nhị'],
  两: ['hai', 'lạng', 'lưỡng'],
  三: ['ba', 'tam'],
  四: ['bốn', 'tứ'],
  五: ['năm', 'ngũ'],
  六: ['sáu', 'lục'],
  七: ['bảy', 'thất'],
  八: ['tám', 'bát'],
  九: ['chín', 'cửu'],
  十: ['mười', 'thập'],
  百: ['trăm', 'bách'],
  千: ['nghìn', 'ngàn', 'thiên'],
  万: ['vạn'],
  亿: ['trăm', 'ức'],
  半: ['nửa', 'bán'],
  双: ['đôi', 'hai', 'song'],
  对: ['đôi', 'cặp', 'đối', 'đúng'],
  丈: ['trượng'],
  尺: ['thước', 'xích'],
  寸: ['tấc', 'thốn'],
  斤: ['cân'],
  // Colors & materials
  金: ['vàng', 'kim'],
  银: ['bạc', 'ngân'],
  铜: ['đồng'],
  铁: ['sắt', 'thiết'],
  钢: ['thép', 'cương'],
  玉: ['ngọc'],
  宝: ['báu', 'bảo'],
  珠: ['châu', 'ngọc'],
  黑: ['đen', 'hắc'],
  白: ['trắng', 'bạch', 'rõ'],
  红: ['đỏ', 'hồng'],
  赤: ['đỏ', 'xích'],
  青: ['xanh', 'thanh'],
  绿: ['xanh', 'lục'],
  蓝: ['xanh', 'lam'],
  黄: ['vàng', 'hoàng'],
  紫: ['tím', 'tử'],
  灰: ['xám', 'tro', 'hôi'],
  // Places, buildings & factions
  城: ['thành'],
  镇: ['trấn'],
  村: ['làng', 'thôn'],
  乡: ['làng', 'quê', 'hương'],
  国: ['nước', 'quốc'],
  家: ['nhà', 'gia'],
  院: ['viện', 'sân'],
  宫: ['cung'],
  殿: ['điện'],
  楼: ['lầu', 'lâu'],
  阁: ['gác', 'các'],
  门: ['cửa', 'môn'],
  宗: ['tông'],
  派: ['phái'],
  帮: ['bang'],
  教: ['giáo'],
  堂: ['đường', 'sảnh'],
  房: ['phòng'],
  室: ['phòng', 'thất'],
  路: ['đường', 'lộ'],
  街: ['phố', 'nhai'],
  桥: ['cầu', 'kiều'],
  岛: ['đảo'],
  洞: ['hang', 'động'],
  穴: ['huyệt'],
  // Body parts
  手: ['tay', 'thủ'],
  脚: ['chân', 'cước'],
  腿: ['chân', 'đùi', 'thối'],
  头: ['đầu'],
  脸: ['mặt', 'kiểm'],
  面: ['mặt', 'diện'],
  眼: ['mắt', 'nhãn'],
  目: ['mắt', 'mục'],
  眉: ['mày', 'mi'],
  耳: ['tai', 'nhĩ'],
  鼻: ['mũi', 'tỵ'],
  嘴: ['mồm', 'miệng', 'chủy'],
  口: ['miệng', 'mồm', 'khẩu'],
  唇: ['môi', 'thần'],
  舌: ['lưỡi', 'thiệt'],
  牙: ['răng', 'nha'],
  颈: ['cổ', 'cảnh'],
  肩: ['vai', 'kiên'],
  胸: ['ngực', 'hung'],
  乳: ['ngực', 'nhũ', 'vú'],
  腰: ['eo', 'yêu'],
  腹: ['bụng', 'phúc'],
  背: ['lưng', 'bối'],
  心: ['lòng', 'tim', 'tâm'],
  血: ['máu', 'huyết'],
  骨: ['xương', 'cốt'],
  肉: ['thịt', 'nhục'],
  皮: ['da', 'bì'],
  发: ['tóc', 'phát'],
  身: ['thân', 'mình'],
  体: ['thể', 'cơ'],
  // People, titles & fantasy
  男: ['nam', 'trai'],
  女: ['nữ', 'gái'],
  子: ['con', 'tử'],
  儿: ['con', 'nhi'],
  父: ['cha', 'phụ'],
  母: ['mẹ', 'mẫu'],
  兄: ['anh', 'huynh'],
  弟: ['em', 'đệ'],
  姐: ['chị', 'tỷ'],
  妹: ['em', 'muội'],
  夫: ['chồng', 'phu'],
  妻: ['vợ', 'thê'],
  公: ['công', 'ông'],
  婆: ['bà', 'bà', 'bà'],
  王: ['vua', 'vương'],
  皇: ['hoàng', 'vua'],
  帝: ['vua', 'đế'],
  主: ['chủ', 'chúa'],
  师: ['thầy', 'sư'],
  徒: ['đồ'],
  侠: ['hiệp'],
  客: ['khách'],
  神: ['thần'],
  仙: ['tiên'],
  圣: ['thánh'],
  魔: ['ma'],
  妖: ['yêu'],
  鬼: ['quỷ', 'ma'],
  精: ['tinh'],
  灵: ['linh'],
  魂: ['hồn'],
  剑: ['kiếm'],
  刀: ['đao'],
  枪: ['thương', 'súng'],
  弓: ['cung'],
  箭: ['tên', 'tiễn'],
  龙: ['rồng', 'long'],
  虎: ['hổ'],
  凤: ['phượng'],
  马: ['ngựa', 'mã'],
  狼: ['sói', 'lang'],
  狐: ['cáo', 'hồ'],
  蛇: ['rắn', 'xà'],
  鸟: ['chim', 'điểu'],
  鹰: ['ưng'],
  话: ['lời', 'nói', 'thoại'],
  事: ['chuyện', 'việc', 'sự'],
  声: ['tiếng', 'giọng', 'thanh'],
  音: ['âm', 'tiếng'],
  名: ['tên', 'danh'],
  字: ['chữ', 'tự'],
  书: ['sách', 'thư'],
  知: ['biết', 'tri'],
  觉: ['cảm', 'giác', 'thấy'],
  得: ['được', 'thấy', 'đắc'],
  明: ['rõ', 'sáng', 'minh'],
  清: ['rõ', 'trong', 'thanh'],
  楚: ['rõ', 'sở'],
  剧: ['kịch'],
  情: ['tình', 'cảm'],
  独: ['độc', 'một'],
  行: ['hành', 'đi', 'được'],
  绝: ['tuyệt'],
  极: ['cực'],
  色: ['màu', 'sắc'],
  全: ['toàn', 'cả'],
  成: ['thành'],
  统: ['thống'],
};

/**
 * Strip Vietnamese diacritics for secondary fuzzy alignment matching.
 */
function stripVietnameseTones(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

/**
 * Convert a single Chinese character + numbered pinyin to its primary clean Hán Việt syllable.
 */
function getCleanHanVietTokens(chineseText: string): string[] {
  if (!chineseText) return [];
  const trad = tify(chineseText);
  const pyArray = pinyin(chineseText, { toneType: 'num', type: 'array', nonZh: 'consecutive' });

  const tokens: string[] = [];
  for (let i = 0; i < chineseText.length; i++) {
    const rawChar = chineseText[i];
    const tradChar = trad[i] || rawChar;
    if (!CJK_REGEX.test(rawChar)) {
      if (rawChar.trim()) tokens.push(rawChar.trim());
      continue;
    }

    const py = pyArray[i] || `${rawChar}`;
    let hv = '';
    try {
      const rawHv = getHanviet(tradChar, [py], false);
      if (rawHv && rawHv !== '_') {
        const firstChoice = rawHv.split(/\s*[,|]\s*/)[0]?.trim();
        if (firstChoice && firstChoice !== '_') {
          hv = firstChoice;
        }
      }
    } catch {
      // Fallback below
    }

    if (!hv && hanvietData[tradChar]) {
      const all = Object.values(hanvietData[tradChar]).flat().filter(Boolean);
      if (all.length > 0) hv = all[0];
    }

    if (!hv) {
      hv = pinyin(rawChar, { toneType: 'none' }).trim() || rawChar;
    }

    tokens.push(hv);
  }

  return tokens;
}

/**
 * Convert Simplified/Traditional Chinese phrase to Hán Việt.
 */
export function toHanViet(chineseText: string, capitalizeEachWord = true): string {
  const cleaned = chineseText.trim();
  if (!cleaned) return '';
  if (!containsCjk(cleaned)) {
    return capitalizeEachWord ? toTitleCase(cleaned) : cleaned.toLowerCase();
  }

  const tokens = getCleanHanVietTokens(cleaned);
  const formatted = tokens.map((tok) =>
    capitalizeEachWord
      ? tok.charAt(0).toUpperCase() + tok.slice(1).toLowerCase()
      : tok.toLowerCase()
  );

  return formatted
    .join(' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

/**
 * Convert any string to Title Case word-by-word (safe for Vietnamese diacritics).
 */
export function toTitleCase(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Convert Chinese phrase to Title-Case Pinyin romanization (e.g. "林凡" -> "Lin Fan").
 */
export function toTitleCasePinyin(chineseText: string): string {
  const cleaned = chineseText.trim();
  if (!cleaned) return '';
  if (!containsCjk(cleaned)) return toTitleCase(cleaned);

  const arr = pinyin(cleaned, { toneType: 'none', type: 'array', nonZh: 'consecutive' });
  return arr
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (/^[a-zA-Z]/.test(s) ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s))
    .join(' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

/**
 * Generate an immediate offline Name Eng suggestion using Western/Anime transliteration map + Title-Case Pinyin fallback.
 */
export function toEnglishNameSuggestion(chineseText: string): string {
  const cleaned = chineseText.trim();
  if (!cleaned) return '';
  if (!containsCjk(cleaned)) return toTitleCase(cleaned);

  if (WESTERN_NAME_MAP[cleaned]) {
    return WESTERN_NAME_MAP[cleaned];
  }

  const sortedKeys = Object.keys(WESTERN_NAME_MAP).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (key.length >= 2 && cleaned.includes(key)) {
      const idx = cleaned.indexOf(key);
      const before = cleaned.slice(0, idx);
      const after = cleaned.slice(idx + key.length);
      const parts = [
        before ? toTitleCasePinyin(before) : '',
        WESTERN_NAME_MAP[key],
        after ? (WESTERN_NAME_MAP[after] || toTitleCasePinyin(after)) : '',
      ].filter(Boolean);
      return parts.join(' ').trim();
    }
  }

  return toTitleCasePinyin(cleaned);
}

interface CharAlignCandidateSet {
  exact: Set<string>;
  folded: Set<string>;
}

/**
 * Get all possible Han-Viet + gloss candidates (exact + tone-folded) for a single Chinese character.
 */
function getAlignmentCandidatesForChar(
  ch: string,
  tradChar: string,
  simpChar: string,
  pyNum: string,
  pyNoTone: string
): CharAlignCandidateSet {
  const exact = new Set<string>();
  const folded = new Set<string>();

  const add = (raw: string) => {
    const norm = normalizeMatchToken(raw);
    if (!norm) return;
    exact.add(norm);
    folded.add(stripVietnameseTones(norm));
  };

  const hvEntry = hanvietData[tradChar];
  if (hvEntry) {
    const exactReading = hvEntry[pyNum.toLowerCase()];
    if (exactReading) {
      for (const h of exactReading) add(h);
    }
    for (const arr of Object.values(hvEntry)) {
      for (const h of arr) add(h);
    }
  }
  const glosses =
    COMMON_CHAR_GLOSSES[ch] ||
    COMMON_CHAR_GLOSSES[simpChar] ||
    COMMON_CHAR_GLOSSES[tradChar];
  if (glosses) {
    for (const g of glosses) add(g);
  }
  if (pyNoTone) {
    add(pyNoTone);
  }
  return { exact, folded };
}

function tokenizeVi(text: string): string[] {
  return text
    .split(/[\s,.;:!?'"“”‘’()[\]{}—\-/…]+/)
    .map(normalizeMatchToken)
    .filter(Boolean);
}

const ALIGN_FILLER_WORDS = new Set([
  'có',
  'bị',
  'được',
  'là',
  'ở',
  'một',
  'những',
  'các',
  'của',
  'và',
  'rồi',
  'đã',
  'này',
  'kia',
  'mà',
  'thì',
  'cũng',
  'lại',
]);

function matchTokenAgainstChar(
  token: string,
  foldedToken: string,
  cand: CharAlignCandidateSet
): number {
  if (!token || !cand || cand.exact.size === 0) return 0;
  const isFiller = ALIGN_FILLER_WORDS.has(token);
  if (cand.exact.has(token)) {
    return isFiller ? 1.6 : 3.4;
  }
  if (foldedToken.length >= 2 && cand.folded.has(foldedToken)) {
    return isFiller ? 0.6 : 1.3;
  }
  return 0;
}

function normalizePunctChar(ch: string): string {
  if (ch === '“' || ch === '”' || ch === '"' || ch === '「' || ch === '」') return '"';
  if (ch === '！' || ch === '!') return '!';
  if (ch === '？' || ch === '?') return '?';
  if (ch === '。' || ch === '.') return '.';
  if (ch === '，' || ch === ',') return ',';
  if (ch === '：' || ch === ':') return ':';
  if (ch === '；' || ch === ';') return ';';
  return '';
}

/**
 * Find the matching Chinese paragraph from sourceParagraphs even if manual splits/merges shifted paragraph counts.
 */
export function findBestMatchingSourceParagraph(opts: {
  viParagraph: string;
  paragraphIndex: number;
  totalViParagraphs: number;
  sourceParagraphs: string[];
}): string {
  const { viParagraph, paragraphIndex, totalViParagraphs, sourceParagraphs } = opts;
  if (sourceParagraphs.length === 0) return '';
  if (sourceParagraphs.length === totalViParagraphs && sourceParagraphs[paragraphIndex]) {
    return sourceParagraphs[paragraphIndex];
  }

  const ratio =
    totalViParagraphs > 1 ? paragraphIndex / (totalViParagraphs - 1) : 0;
  const approxIdx = Math.round(ratio * Math.max(0, sourceParagraphs.length - 1));
  const minIdx = Math.max(0, approxIdx - 4);
  const maxIdx = Math.min(sourceParagraphs.length - 1, approxIdx + 4);

  const viTokens = tokenizeVi(viParagraph);
  const viFolded = viTokens.map(stripVietnameseTones);

  let bestIdx = approxIdx;
  let bestScore = -Infinity;

  for (let i = minIdx; i <= maxIdx; i++) {
    const zh = sourceParagraphs[i];
    const zhTrad = tify(zh);
    const zhSimp = sify(zh);
    const pyNums = pinyin(zh, { toneType: 'num', type: 'array', nonZh: 'consecutive' });
    const pyNones = pinyin(zh, { toneType: 'none', type: 'array', nonZh: 'consecutive' });

    const seenTok = new Set<number>();
    let hits = 0;
    for (let cIdx = 0; cIdx < zh.length; cIdx++) {
      const c = zh[cIdx];
      if (!CJK_REGEX.test(c)) continue;
      const cand = getAlignmentCandidatesForChar(
        c,
        zhTrad[cIdx] || c,
        zhSimp[cIdx] || c,
        pyNums[cIdx] || '',
        pyNones[cIdx] || ''
      );
      for (let ti = 0; ti < viTokens.length; ti++) {
        if (seenTok.has(ti)) continue;
        const m = matchTokenAgainstChar(viTokens[ti], viFolded[ti], cand);
        if (m > 0) {
          seenTok.add(ti);
          hits += m;
          break;
        }
      }
    }

    const lenRatioDiff = Math.abs(zh.length * 3.2 - viParagraph.length) / Math.max(40, viParagraph.length);
    const distPenalty = Math.abs(i - approxIdx) * 0.5;
    const score = hits - lenRatioDiff * 1.5 - distPenalty;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  return sourceParagraphs[bestIdx] || sourceParagraphs[approxIdx] || '';
}

export interface AlignedChineseResult {
  zhPhrase: string;
  zhStart: number;
  zhEnd: number;
}

/**
 * Align a selected Vietnamese phrase back to its most likely Chinese source substring
 * inside the corresponding Chinese paragraph using:
 * 1) Dictionary matching
 * 2) Character Han-Viet + gloss + tone-folded multi-signal matching
 * 3) Left & right context + punctuation anchor locking
 */
export function alignVietnameseToChinese(opts: {
  selectedVi: string;
  viParagraph: string;
  selectionStartInPara: number;
  selectionEndInPara: number;
  zhParagraph: string;
  dictionaries?: DictionaryEntry[];
}): AlignedChineseResult {
  const {
    selectedVi,
    viParagraph,
    selectionStartInPara,
    selectionEndInPara,
    zhParagraph,
    dictionaries = [],
  } = opts;

  const trimmedVi = selectedVi.trim();
  if (!zhParagraph.trim()) {
    return { zhPhrase: containsCjk(trimmedVi) ? trimmedVi : '', zhStart: 0, zhEnd: 0 };
  }

  // If selected text itself is already Chinese
  if (containsCjk(trimmedVi)) {
    const idx = zhParagraph.indexOf(trimmedVi);
    if (idx >= 0) {
      return { zhPhrase: trimmedVi, zhStart: idx, zhEnd: idx + trimmedVi.length };
    }
    return { zhPhrase: trimmedVi, zhStart: 0, zhEnd: trimmedVi.length };
  }

  // 1. Exact Dictionary match check first
  const lowVi = trimmedVi.toLowerCase();
  const sortedDicts = [...dictionaries]
    .filter((d) => d.enabled && d.original.trim() && d.replacement.trim())
    .sort((a, b) => b.replacement.length - a.replacement.length);

  for (const d of sortedDicts) {
    if (d.replacement.trim().toLowerCase() === lowVi && containsCjk(d.original)) {
      const idx = zhParagraph.indexOf(d.original.trim());
      if (idx >= 0) {
        return {
          zhPhrase: d.original.trim(),
          zhStart: idx,
          zhEnd: idx + d.original.trim().length,
        };
      }
    }
  }

  // 2. Build character table for zhParagraph
  const zhTrad = tify(zhParagraph);
  const zhSimp = sify(zhParagraph);
  const pyNums = pinyin(zhParagraph, { toneType: 'num', type: 'array', nonZh: 'consecutive' });
  const pyNones = pinyin(zhParagraph, { toneType: 'none', type: 'array', nonZh: 'consecutive' });

  const charCandidates: CharAlignCandidateSet[] = [];
  for (let i = 0; i < zhParagraph.length; i++) {
    const c = zhParagraph[i];
    if (CJK_REGEX.test(c)) {
      charCandidates.push(
        getAlignmentCandidatesForChar(
          c,
          zhTrad[i] || c,
          zhSimp[i] || c,
          pyNums[i] || '',
          pyNones[i] || ''
        )
      );
    } else if (/[\p{L}\p{N}]/u.test(c)) {
      const norm = normalizeMatchToken(c);
      charCandidates.push({
        exact: new Set(norm ? [norm] : []),
        folded: new Set(norm ? [stripVietnameseTones(norm)] : []),
      });
    } else {
      charCandidates.push({ exact: new Set(), folded: new Set() });
    }
  }

  // Tokenize selected phrase and immediate left/right surrounding context
  const viTokens = tokenizeVi(trimmedVi);
  const viFolded = viTokens.map(stripVietnameseTones);

  const viBeforeSlice = viParagraph.slice(Math.max(0, selectionStartInPara - 90), selectionStartInPara);
  const viAfterSlice = viParagraph.slice(
    selectionEndInPara,
    Math.min(viParagraph.length, selectionEndInPara + 90)
  );

  const prefixTokens = tokenizeVi(viBeforeSlice).slice(-5);
  const prefixFolded = prefixTokens.map(stripVietnameseTones);
  const suffixTokens = tokenizeVi(viAfterSlice).slice(0, 5);
  const suffixFolded = suffixTokens.map(stripVietnameseTones);

  // Detect immediate punctuation just before / after the Vietnamese selection
  const beforeNonSpace = viBeforeSlice.trimEnd();
  const afterNonSpace = viAfterSlice.trimStart();
  const expectedLeftPunct = beforeNonSpace
    ? normalizePunctChar(beforeNonSpace[beforeNonSpace.length - 1])
    : '';
  const expectedRightPunct = afterNonSpace
    ? normalizePunctChar(afterNonSpace[0])
    : '';
  const isAtParaStart = selectionStartInPara <= 2 || beforeNonSpace.length === 0;
  const isAtParaEnd = selectionEndInPara >= viParagraph.length - 2 || afterNonSpace.length === 0;

  // Expected relative position in zhParagraph
  const safeViLen = Math.max(1, viParagraph.length);
  const startRatio = Math.max(0, Math.min(1, selectionStartInPara / safeViLen));
  const endRatio = Math.max(startRatio, Math.min(1, selectionEndInPara / safeViLen));
  const midRatio = (startRatio + endRatio) / 2;
  const expectedMidZh = Math.round(midRatio * zhParagraph.length);
  const expectedLenZh = Math.max(1, Math.min(24, viTokens.length || 2));

  // Search full paragraph if <= 400 chars so context shifts never miss, else wide window
  const windowMargin = zhParagraph.length <= 400 ? zhParagraph.length : Math.max(80, expectedLenZh * 6);
  const searchMin = Math.max(0, expectedMidZh - windowMargin);
  const searchMax = Math.min(zhParagraph.length, expectedMidZh + windowMargin);

  let bestScore = -Infinity;
  let bestStart = Math.max(0, expectedMidZh - Math.floor(expectedLenZh / 2));
  let bestEnd = Math.min(zhParagraph.length, bestStart + expectedLenZh);

  if (viTokens.length > 0) {
    const minSpan = 1;
    const maxSpan = Math.min(26, Math.max(4, viTokens.length * 2 + 2));

    for (let s = searchMin; s < searchMax; s++) {
      if (!CJK_REGEX.test(zhParagraph[s]) && !/[\p{L}\p{N}]/u.test(zhParagraph[s])) continue;

      // Precompute left context bonus for starting at `s`
      let leftContextBonus = 0;
      if (isAtParaStart && s <= 2) {
        leftContextBonus += 2.0;
      }
      if (expectedLeftPunct) {
        for (let lb = s - 1; lb >= Math.max(0, s - 3); lb--) {
          if (CJK_REGEX.test(zhParagraph[lb])) break;
          if (normalizePunctChar(zhParagraph[lb]) === expectedLeftPunct) {
            leftContextBonus += 2.6;
            break;
          }
        }
      }
      if (prefixTokens.length > 0) {
        const leftCtxStart = Math.max(0, s - 10);
        const usedPref = new Set<number>();
        for (let k = leftCtxStart; k < s; k++) {
          const cand = charCandidates[k];
          if (!cand || cand.exact.size === 0) continue;
          for (let pi = prefixTokens.length - 1; pi >= 0; pi--) {
            if (usedPref.has(pi)) continue;
            const m = matchTokenAgainstChar(prefixTokens[pi], prefixFolded[pi], cand);
            if (m > 0) {
              usedPref.add(pi);
              // Closer tokens near `s` count more
              const recency = 0.5 + ((k - leftCtxStart) / Math.max(1, s - leftCtxStart)) * 0.5;
              leftContextBonus += Math.min(2.0, m * 0.6) * recency;
              break;
            }
          }
        }
      }

      for (let len = minSpan; len <= maxSpan && s + len <= zhParagraph.length; len++) {
        const e = s + len;
        const sliceText = zhParagraph.slice(s, e);
        if (/[。！？\n]/.test(sliceText)) break;
        if (!CJK_REGEX.test(zhParagraph[e - 1]) && !/[\p{L}\p{N}]/u.test(zhParagraph[e - 1])) continue;

        let hits = 0;
        let lastMatchedTokIdx = -1;
        let orderedBonus = 0;
        let cjkCount = 0;

        const usedViIdx = new Set<number>();
        for (let k = s; k < e; k++) {
          if (CJK_REGEX.test(zhParagraph[k])) cjkCount++;
          const cand = charCandidates[k];
          if (!cand || cand.exact.size === 0) continue;

          let bestTokIdx = -1;
          let bestTokScore = 0;
          for (let ti = 0; ti < viTokens.length; ti++) {
            if (usedViIdx.has(ti)) continue;
            const m = matchTokenAgainstChar(viTokens[ti], viFolded[ti], cand);
            if (m > bestTokScore) {
              bestTokScore = m;
              bestTokIdx = ti;
            }
          }

          if (bestTokIdx >= 0) {
            usedViIdx.add(bestTokIdx);
            hits += bestTokScore;
            if (bestTokIdx > lastMatchedTokIdx) {
              orderedBonus += 0.65;
              lastMatchedTokIdx = bestTokIdx;
            }
          }
        }

        if (cjkCount === 0) continue;

        // Right context bonus for ending at `e`
        let rightContextBonus = 0;
        if (isAtParaEnd && e >= zhParagraph.length - 2) {
          rightContextBonus += 2.0;
        }
        if (expectedRightPunct) {
          for (let rb = e; rb < Math.min(zhParagraph.length, e + 3); rb++) {
            if (CJK_REGEX.test(zhParagraph[rb])) break;
            if (normalizePunctChar(zhParagraph[rb]) === expectedRightPunct) {
              rightContextBonus += 2.6;
              break;
            }
          }
        }
        if (suffixTokens.length > 0) {
          const rightCtxEnd = Math.min(zhParagraph.length, e + 10);
          const usedSuff = new Set<number>();
          for (let k = e; k < rightCtxEnd; k++) {
            const cand = charCandidates[k];
            if (!cand || cand.exact.size === 0) continue;
            for (let si = 0; si < suffixTokens.length; si++) {
              if (usedSuff.has(si)) continue;
              const m = matchTokenAgainstChar(suffixTokens[si], suffixFolded[si], cand);
              if (m > 0) {
                usedSuff.add(si);
                const recency = 1.0 - ((k - e) / Math.max(1, rightCtxEnd - e)) * 0.5;
                rightContextBonus += Math.min(2.0, m * 0.6) * recency;
                break;
              }
            }
          }
        }

        const unmatchedChars = Math.max(0, cjkCount - usedViIdx.size);
        const unmatchedVi = Math.max(0, viTokens.length - usedViIdx.size);
        const spanMid = (s + e) / 2;
        const distPenalty = (Math.abs(spanMid - expectedMidZh) / Math.max(25, zhParagraph.length)) * 1.8;

        // Proper edge boundary bonus (never double-counted on 1-char spans)
        let edgeBonus = 0;
        const firstMatch = viTokens.some((t, ti) => matchTokenAgainstChar(t, viFolded[ti], charCandidates[s]) > 0);
        if (firstMatch) edgeBonus += 0.85;
        if (e - s > 1) {
          const lastMatch = viTokens.some((t, ti) => matchTokenAgainstChar(t, viFolded[ti], charCandidates[e - 1]) > 0);
          if (lastMatch) edgeBonus += 0.85;
        }

        // Encourage CJK character count to stay proportional to Vietnamese word count
        const shortSpanPenalty =
          viTokens.length >= 2 && cjkCount < viTokens.length
            ? (viTokens.length - cjkCount) * 0.9
            : 0;
        const parityBonus = cjkCount === viTokens.length ? 0.6 : 0;

        const score =
          hits +
          orderedBonus +
          edgeBonus +
          parityBonus +
          leftContextBonus +
          rightContextBonus -
          unmatchedChars * 0.9 -
          unmatchedVi * 0.75 -
          shortSpanPenalty -
          distPenalty;

        if (score > bestScore) {
          bestScore = score;
          bestStart = s;
          bestEnd = e;
        }
      }
    }
  }

  // If no meaningful match found, fall back cleanly to proportional CJK span
  if (bestScore <= 0.5) {
    let s = Math.max(0, Math.min(zhParagraph.length - 1, Math.round(startRatio * zhParagraph.length)));
    let e = Math.max(s + 1, Math.min(zhParagraph.length, Math.round(endRatio * zhParagraph.length)));
    while (s < e && !CJK_REGEX.test(zhParagraph[s])) s++;
    while (e > s && !CJK_REGEX.test(zhParagraph[e - 1])) e--;
    if (s >= e) {
      s = Math.max(0, Math.min(zhParagraph.length - 1, expectedMidZh - 1));
      e = Math.min(zhParagraph.length, s + Math.max(2, expectedLenZh));
    }
    bestStart = s;
    bestEnd = e;
  }

  return {
    zhPhrase: zhParagraph.slice(bestStart, bestEnd).trim(),
    zhStart: bestStart,
    zhEnd: bestEnd,
  };
}

/**
 * Expand a selection inside a paragraph by 1 word/character leftward or rightward.
 */
export function expandSelectionInParagraph(opts: {
  paragraph: string;
  startOffset: number;
  endOffset: number;
  direction: 'left' | 'right';
}): { text: string; startOffset: number; endOffset: number } {
  const { paragraph, direction } = opts;
  let start = Math.max(0, Math.min(paragraph.length, opts.startOffset));
  let end = Math.max(start, Math.min(paragraph.length, opts.endOffset));

  const isCjkMode = containsCjk(paragraph.slice(start, end)) || containsCjk(paragraph);

  if (direction === 'left' && start > 0) {
    if (isCjkMode && CJK_REGEX.test(paragraph[start - 1])) {
      start -= 1;
    } else {
      // Skip whitespace/punctuation leftward then grab previous word
      let cur = start - 1;
      while (cur > 0 && /[\s,.;:!?'"“”‘’()[\]{}—\-]/.test(paragraph[cur])) {
        cur--;
      }
      if (CJK_REGEX.test(paragraph[cur])) {
        start = cur;
      } else {
        while (cur > 0 && !/[\s,.;:!?'"“”‘’()[\]{}—\-]/.test(paragraph[cur - 1])) {
          cur--;
        }
        start = cur;
      }
    }
  } else if (direction === 'right' && end < paragraph.length) {
    if (isCjkMode && CJK_REGEX.test(paragraph[end])) {
      end += 1;
    } else {
      let cur = end;
      while (cur < paragraph.length && /[\s,.;:!?'"“”‘’()[\]{}—\-]/.test(paragraph[cur])) {
        cur++;
      }
      if (cur < paragraph.length) {
        if (CJK_REGEX.test(paragraph[cur])) {
          cur++;
        } else {
          while (cur < paragraph.length && !/[\s,.;:!?'"“”‘’()[\]{}—\-]/.test(paragraph[cur])) {
            cur++;
          }
        }
      }
      end = cur;
    }
  }

  return {
    text: paragraph.slice(start, end).trim(),
    startOffset: start,
    endOffset: end,
  };
}

export interface PhraseOnlineLookupResult {
  vi?: string;
  nameEng?: string;
}

/**
 * Optional online lookup for Vietnamese meaning + Name Eng suggestion (never throws, fast fallback).
 */
export async function lookupChinesePhraseOnline(
  zhPhrase: string,
  signal?: AbortSignal
): Promise<PhraseOnlineLookupResult> {
  const clean = zhPhrase.trim();
  if (!clean || !containsCjk(clean)) return {};

  try {
    if (typeof window !== 'undefined' && window.desktopBridge?.analyzePhrase) {
      const res = await window.desktopBridge.analyzePhrase(clean);
      return res || {};
    }

    const resp = await fetch('/api/phrase-analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phrase: clean }),
      signal,
    });
    if (!resp.ok) return {};
    const data = (await resp.json()) as PhraseOnlineLookupResult;
    return data || {};
  } catch {
    return {};
  }
}
