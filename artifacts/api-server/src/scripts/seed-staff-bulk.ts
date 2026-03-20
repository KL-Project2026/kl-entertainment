/**
 * Bulk staff seed: ~400 staff across 10 branches
 * Run: pnpm --filter @workspace/api-server exec tsx src/scripts/seed-staff-bulk.ts
 */
import { pool } from "@workspace/db";

// ─── Branch definitions ───────────────────────────────────────────
const BRANCHES = [
  { id: "d44ca290-a086-439d-9657-07fc5ebb689c", code: "KL01", mgr: 3, hst: 25, gen: 10, drv: 3, kth: 5 },
  { id: "6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c", code: "KL02", mgr: 3, hst: 25, gen: 10, drv: 3, kth: 5 },
  { id: "bb000001-0000-0000-0000-000000000003", code: "KL03", mgr: 2, hst: 22, gen: 10, drv: 2, kth: 4 },
  { id: "bb000001-0000-0000-0000-000000000004", code: "KL04", mgr: 2, hst: 22, gen: 10, drv: 2, kth: 4 },
  { id: "bb000001-0000-0000-0000-000000000005", code: "KL05", mgr: 2, hst: 20, gen: 10, drv: 2, kth: 4 },
  { id: "bb000001-0000-0000-0000-000000000006", code: "KL06", mgr: 2, hst: 20, gen: 10, drv: 2, kth: 4 },
  { id: "bb000001-0000-0000-0000-000000000007", code: "KL07", mgr: 2, hst: 20, gen: 10, drv: 2, kth: 4 },
  { id: "bb000001-0000-0000-0000-000000000008", code: "KL08", mgr: 2, hst: 20, gen: 10, drv: 2, kth: 4 },
  { id: "bb000001-0000-0000-0000-000000000009", code: "KL09", mgr: 2, hst: 20, gen:  8, drv: 2, kth: 4 },
  { id: "bb000001-0000-0000-0000-000000000010", code: "KL10", mgr: 2, hst: 20, gen:  8, drv: 2, kth: 4 },
];

// ─── Female hostess names [fullName, nickname] ────────────────────
const HOSTESS_NAMES: [string, string][] = [
  // Chinese-Malaysian
  ["Mei Ling Wong", "Mei"], ["Xiao Hui Lim", "Xiao"], ["Jing Yi Tan", "Jing"],
  ["Hui Min Lee", "Hui"], ["Yan Ting Ng", "Yan"], ["Li Wei Chen", "Lily"],
  ["Fang Fang Koh", "Fang"], ["Qi Qi Chong", "Qi"], ["Bao Er Yap", "Bao"],
  ["Shu Ting Ong", "Shu"], ["Xin Yi Lam", "Xin"], ["Zhi Ting Low", "Zhi"],
  ["Wen Wen Goh", "Wen"], ["Jia En Tee", "Jia"], ["Xue Ling Woo", "Xue"],
  ["Yu Xuan Chua", "Yuki"], ["Meng Meng Ho", "Meng"], ["Ling Ling Pang", "Ling"],
  ["Zi Xuan Kong", "Zi"], ["Bing Bing Tong", "Bing"], ["Rui Xin Leong", "Rui"],
  ["Si Qi Yeoh", "Sisi"], ["Ke Ke Foo", "Keke"], ["Nian Nian Heng", "Nian"],
  ["Tian Tian Chai", "Tian"], ["Qian Yi Liang", "Qian"], ["Ai Li Khoo", "Ai"],
  ["Hua Hua Chew", "Hua"], ["Dan Dan Soong", "Dan"], ["Rou Ying Tsai", "Rou"],
  ["Bei Bei Fong", "Bei"], ["Shan Shan Quah", "Shan"], ["Rou Er Chong", "Rourou"],
  ["Ming Ming Ooi", "Ming"], ["Juan Juan Hoo", "Juan"], ["Yu Qi Ang", "Yuqi"],
  ["Xiang Xiang Su", "Xiang"], ["Bi Bi Teoh", "Bibi"], ["Mei Er Koay", "Meier"],
  ["Lian Lian Phang", "Lian"], ["Yan Yan Saw", "Yanyan"], ["Yin Yin Mah", "Yin"],
  // Thai names
  ["Nara Petcharat", "Nara"], ["Ploy Siriporn", "Ploy"], ["Fern Waranya", "Fern"],
  ["Mint Natnicha", "Mint"], ["Pim Sirinapa", "Pim"], ["Bow Supanida", "Bow"],
  ["Gift Napaporn", "Gift"], ["Nook Thanida", "Nook"], ["Aom Wanphen", "Aom"],
  ["Nan Supamas", "Nan"], ["Bell Orathai", "Bell"], ["Joy Pennapa", "Joy"],
  ["Pink Nattaya", "Pink"], ["Dream Siriwan", "Dream"], ["Aim Pattama", "Aim"],
  ["Kwan Siriphan", "Kwan"], ["Bee Suwannee", "Bee"], ["Noon Suchada", "Noon"],
  ["Pear Nanthika", "Pear"], ["Mam Phatsara", "Mam"],
  // Vietnamese names
  ["Linh Nguyen", "Linh"], ["Mai Tran", "Mai"], ["Lan Pham", "Lan"],
  ["Thu Hoang", "Thu"], ["Huong Le", "Huong"], ["Thao Vu", "Thao"],
  ["Phuong Dang", "Phuong"], ["Nhi Bui", "Nhi"], ["Quynh Ly", "Quynh"],
  ["Vy Duong", "Vy"], ["Ngoc Dinh", "Ngoc"], ["Trang Luong", "Trang"],
  ["Khanh Trinh", "Khanh"], ["Hoa Ngo", "Hoa"], ["Bich Dao", "Bich"],
  ["Tuyet Hoang", "Tuyet"], ["Hanh Truong", "Hanh"], ["Xuan Luu", "Xuan"],
  ["Thu Ha Vo", "Ha"], ["My Linh Chu", "MyLinh"],
  // Filipino names
  ["Maria Santos", "Maria"], ["Ana Reyes", "Ana"], ["Rose Cruz", "Rose"],
  ["Grace Garcia", "Grace"], ["Joy Dela Cruz", "Joy"], ["Cristina Lopez", "Cris"],
  ["Angelica Ramos", "Angel"], ["Patricia Bautista", "Pat"], ["Maricel Mendoza", "Maricel"],
  ["Lovely Aquino", "Lovely"], ["Cheryl Villanueva", "Cheryl"], ["Rowena Castro", "Rowena"],
  ["Mylene Domingo", "Mylene"], ["Liza Fernandez", "Liza"], ["Gina Soriano", "Gina"],
  ["Sheila Pascual", "Sheila"], ["Faith Navarro", "Faith"], ["Hope Tolentino", "Hope"],
  ["Charm Panganiban", "Charm"], ["Nica Salazar", "Nica"],
  // Indonesian names
  ["Dewi Rahayu", "Dewi"], ["Sari Wulandari", "Sari"], ["Indah Permata", "Indah"],
  ["Cantik Wijaya", "Cantik"], ["Bunga Kusuma", "Bunga"], ["Putri Handayani", "Putri"],
  ["Ayu Maharani", "Ayu"], ["Citra Lestari", "Citra"], ["Rina Susanti", "Rina"],
  ["Fitri Anggraini", "Fitri"], ["Desi Natalia", "Desi"], ["Yuli Astuti", "Yuli"],
  ["Winda Pratiwi", "Winda"], ["Mega Sari", "Mega"], ["Nova Kartika", "Nova"],
  // Western / mixed
  ["Sophie Anderson", "Sophie"], ["Emma Williams", "Emma"], ["Stella Johnson", "Stella"],
  ["Luna Martinez", "Luna"], ["Zoe Thompson", "Zoe"], ["Chloe Davis", "Chloe"],
  ["Mia Robinson", "Mia"], ["Isabella Clark", "Bella"], ["Ava Lewis", "Ava"],
  ["Lily Walker", "Lily"], ["Charlotte Hall", "Charlie"], ["Olivia Young", "Olivia"],
  ["Amelia King", "Amy"], ["Harper Wright", "Harper"], ["Scarlett Baker", "Scar"],
  ["Violet Nelson", "Vi"], ["Aurora Perez", "Rora"], ["Penelope Roberts", "Penny"],
  ["Camille Turner", "Camille"], ["Elise Phillips", "Elise"],
  // Malay names
  ["Nurul Ain Aziz", "Ain"], ["Siti Nadia Razak", "Nadia"], ["Fatimah Zahra Karim", "Fatimah"],
  ["Aisyah Binti Yusof", "Aisyah"], ["Suraya Binti Ahmad", "Suraya"],
  ["Haslinda Binti Ismail", "Linda"], ["Norfazilah Hamdan", "Fazi"],
  ["Rohana Binti Osman", "Rohana"], ["Zuraida Binti Jamal", "Zurie"],
  ["Norhayati Hassan", "Hayati"], ["Sharifah Maimunah", "Shafiqah"], ["Mariam Binti Daud", "Mariam"],
  ["Roslina Binti Bakar", "Lina"], ["Juliana Binti Mansor", "Julie"], ["Habibah Binti Salleh", "Habibah"],
  ["Maizatul Akmar", "Maizatul"], ["Farah Nadia Ghani", "Farah"],
  ["Nurul Huda Ibrahim", "Huda"], ["Siti Rahmah Omar", "Rahmah"], ["Ainul Mardhiah", "Ainul"],
  // Korean / Japanese (popular in KL KTV)
  ["Ji Yeon Kim", "Jiyeon"], ["So Yeon Park", "Soyeon"], ["Min Ji Lee", "Minji"],
  ["Ye Jin Choi", "Yejin"], ["Ha Eun Jung", "Haeun"], ["Bo Ram Shin", "Boram"],
  ["Soo Ah Yoon", "Sooah"], ["Hyun Ji Kwon", "Hyunji"], ["Eun Bi Jang", "Eunbi"],
  ["Da Eun Oh", "Daeun"], ["Yuna Tanaka", "Yuna"], ["Hana Sato", "Hana"],
  ["Miku Yamamoto", "Miku"], ["Rin Watanabe", "Rin"], ["Sakura Nakamura", "Sakura"],
  ["Ai Kobayashi", "Ai"], ["Yuki Ito", "Yuki"], ["Nana Kato", "Nana"],
  ["Momo Suzuki", "Momo"], ["Riku Hayashi", "Riku"],
];

// ─── Male manager names [fullName, nickname] ──────────────────────
const MANAGER_NAMES: [string, string][] = [
  ["William Tan Kah Leong", "William"], ["Jason Lim Wei Jian", "Jason"],
  ["Kevin Wong Chun Kit", "Kevin"], ["Michael Lee Boon Huat", "Michael"],
  ["Steven Ng Wai Keat", "Steven"], ["David Ooi Kian Seng", "David"],
  ["Raymond Chong Kok Wai", "Raymond"], ["Eric Yap Eng Kiat", "Eric"],
  ["Alan Teh Boon Ping", "Alan"], ["Brian Cheah Chee Wai", "Brian"],
  ["Marcus Goh Yew Leng", "Marcus"], ["Victor Low Sing Pei", "Victor"],
  ["Thomas Chua Wei Ming", "Thomas"], ["Daniel Ho Kok Leong", "Daniel"],
  ["Richard Koh Boon Siew", "Richard"], ["Patrick Leong Wai Keong", "Patrick"],
  ["Anthony Tay Choon Beng", "Anthony"], ["Henry Chan Wai Lun", "Henry"],
  ["Eddie Sim Kah Wai", "Eddie"], ["Kelvin Foo Chee Kiong", "Kelvin"],
  ["Bernard Woo Kok Keong", "Bernard"], ["Nelson Pang Wai Kit", "Nelson"],
  ["Peter Chew Boon Hwa", "Peter"], ["Simon Quah Kim Hock", "Simon"],
  ["James Ang Teck Seng", "James"], ["Gary Fong Wei Liang", "Gary"],
  ["Kenneth Beh Choon Fong", "Kenneth"], ["Lawrence Tan Swee Huat", "Lawrence"],
  ["Vincent Soo Kim Wee", "Vincent"], ["Albert Loo Khay Keong", "Albert"],
];

// ─── Driver names [fullName, nickname] ────────────────────────────
const DRIVER_NAMES: [string, string][] = [
  ["Ahmad Zulkifli Bin Samat", "Ahmad"], ["Mohd Faizal Bin Kamarudin", "Faizal"],
  ["Razif Bin Abdullah", "Razif"], ["Shahrul Nizam Bin Hashim", "Shahrul"],
  ["Khairul Anwar Bin Ismail", "Khairul"], ["Azmi Bin Mohamed", "Azmi"],
  ["Hafiz Bin Othman", "Hafiz"], ["Rozi Bin Taib", "Rozi"],
  ["Johari Bin Jaafar", "Johari"], ["Zulhilmi Bin Ramli", "Zul"],
  ["Muhamad Afiq Bin Sulaiman", "Afiq"], ["Hairul Bin Hamid", "Hairul"],
  ["Saiful Bahari Bin Kassim", "Saiful"], ["Roslan Bin Daud", "Roslan"],
  ["Mohd Haziq Bin Noor", "Haziq"], ["Azizul Bin Wahab", "Azizul"],
  ["Fadzil Bin Yusuf", "Fadzil"], ["Norzaidi Bin Mat", "Zaidi"],
  ["Shamsul Bin Ariffin", "Shamsul"], ["Kamarul Bin Zaman", "Kamar"],
  ["Ridzwan Bin Rashid", "Ridzwan"], ["Hanafi Bin Ghani", "Hanafi"],
  ["Mahzan Bin Shuib", "Mahzan"], ["Zabidi Bin Sudin", "Zabidi"],
  ["Ruzaimi Bin Rajab", "Ruzaimi"], ["Fairuz Bin Hamdan", "Fairuz"],
  ["Norzainy Bin Othman", "Zainy"], ["Bukhari Bin Nasir", "Bukhari"],
  ["Redza Bin Zainudin", "Redza"], ["Azhar Bin Bakar", "Azhar"],
];

// ─── Kitchen names [fullName, nickname] ──────────────────────────
const KITCHEN_NAMES: [string, string][] = [
  ["Mohammed Rafique Uddin", "Rafique"], ["Abdul Karim Mia", "Karim"],
  ["Md Shahin Alam", "Shahin"], ["Nur Islam Bhuiyan", "Islam"],
  ["Mohammad Jakir Hossain", "Jakir"], ["Aminul Haque Siddique", "Aminul"],
  ["Belal Ahmed Khan", "Belal"], ["Habibur Rahman Chowdhury", "Habib"],
  ["Mofizul Islam Talukder", "Mofiz"], ["Shamsul Huda Patwary", "Shamsul"],
  ["Ravi Kumar Pillai", "Ravi"], ["Murugan Subramaniam", "Murugan"],
  ["Selvakumar Ramasamy", "Selva"], ["Arumugam Krishnan", "Arum"],
  ["Shanmugam Perumal", "Shan"], ["Kumaran Nair", "Kumar"],
  ["Vengadesan Gopal", "Venga"], ["Balakrishnan Annamalai", "Bala"],
  ["Suppiah Muniandy", "Suppi"], ["Govindasamy Naicker", "Govind"],
  ["Rohit Sharma", "Rohit"], ["Vikram Singh", "Vikram"],
  ["Suresh Patel", "Suresh"], ["Deepak Verma", "Deepak"],
  ["Pradeep Kumar", "Pradeep"], ["Sanjay Mehta", "Sanjay"],
  ["Ramesh Gupta", "Ramesh"], ["Rajesh Pandey", "Rajesh"],
  ["Anil Thakur", "Anil"], ["Naresh Yadav", "Naresh"],
  ["Prakash Reddy", "Prakash"], ["Venkat Rao", "Venkat"],
  ["Dinesh Babu", "Dinesh"], ["Santosh Kumar", "Santosh"],
  ["Ganesh Prasad", "Ganesh"], ["Sunil Tiwari", "Sunil"],
  ["Manoj Dubey", "Manoj"], ["Chandra Sekhar", "Chandra"],
  ["Praveen Kumar", "Praveen"], ["Harish Mohan", "Harish"],
];

// ─── General / Hall staff names (mixed) ─────────────────────────
const GENERAL_NAMES: [string, string][] = [
  ["Alex Tan Wei Liang", "Alex"], ["Ben Lim Chee Keong", "Ben"],
  ["Chris Wong Kah Fai", "Chris"], ["Derek Lee Wai Keong", "Derek"],
  ["Eugene Ng Choon Kiat", "Eugene"], ["Felix Ooi Kim Leong", "Felix"],
  ["Gary Yap Weng Kit", "Gary"], ["Harry Goh Kok Wai", "Harry"],
  ["Ivan Chong Wei Ping", "Ivan"], ["Jerry Teh Boon Lim", "Jerry"],
  ["Ken Low Seng Huat", "Ken"], ["Leo Cheah Chin Wai", "Leo"],
  ["Marcus Ho Teck Beng", "Marcus"], ["Nathan Chua Yew Boon", "Nathan"],
  ["Oscar Koh Wai Kian", "Oscar"], ["Paul Leong Beng Chai", "Paul"],
  ["Qin Zhang Wei", "Qin"], ["Ryan Chan Kin Mun", "Ryan"],
  ["Sam Sim Kah Hoong", "Sam"], ["Tim Foo Chee Keong", "Tim"],
  ["Uma Devi Pillai", "Uma"], ["Vicky Chew Mei Fong", "Vicky"],
  ["Wendy Woo Siew Lin", "Wendy"], ["Xavier Ang Swee Heng", "Xavier"],
  ["Yvonne Fong Li Ling", "Yvonne"], ["Zachary Beh Kok Sin", "Zac"],
  ["Aaron Soo Wai Loong", "Aaron"], ["Betty Loo Ai Ling", "Betty"],
  ["Carl Quah Boon Tiong", "Carl"], ["Diana Pang Sow Lin", "Diana"],
  ["Eddie Soong Wai Hoe", "Eddie"], ["Fiona Yong Ah Kow", "Fiona"],
  ["Glen Chong Teck Yoong", "Glen"], ["Hannah Tong Lay Kuen", "Hannah"],
  ["Ian Kong Wai Shan", "Ian"], ["Jenny Su Lan Ing", "Jenny"],
  ["Karl Yeo Boon Kang", "Karl"], ["Laura Saw Mei Mei", "Laura"],
  ["Mike Mah Swee Lee", "Mike"], ["Nancy Teoh Swee Hong", "Nancy"],
  ["Oliver Koay Beng Keat", "Oliver"], ["Pamela Phang Siow Lin", "Pam"],
  ["Quincy Kong Ah Soon", "Quincy"], ["Rachel Soh Kim Lay", "Rachel"],
  ["Steve Tan Ah Beng", "Steve"], ["Tina Lim Sook Lin", "Tina"],
  ["Ulric Ho Kin Weng", "Ulric"], ["Violet Lee Gaik Lean", "Violet"],
  ["Wesley Chan Chin Keong", "Wes"], ["Xena Ng Bee Lian", "Xena"],
  ["Yolanda Goh Ai Lin", "Yola"], ["Zara Chu Siew Ngor", "Zara"],
  ["Adam Ibrahim Mohd", "Adam"], ["Bella Mustafa Kemal", "Bella"],
  ["Caden Amir Hamzah", "Caden"], ["Dian Norhaini Ahmad", "Dian"],
  ["Emir Hariz Baharudin", "Emir"], ["Fara Izzati Mazlan", "Fara"],
  ["Ghazi Bin Hamdan", "Ghazi"], ["Hani Binti Basri", "Hani"],
  ["Irfan Khalid Mohamad", "Irfan"], ["Jasmine Rashidah Yusof", "Jasmine"],
  ["Kevin Zhang Xiaolong", "Kevin"], ["Lena Park Soojin", "Lena"],
  ["Mika Sato Hiroshi", "Mika"], ["Nina Kobayashi Yui", "Nina"],
  ["Otto van der Berg", "Otto"], ["Petra Johansson", "Petra"],
  ["Quinn Chen Jiaming", "Quinn"], ["Rosa Hernandez", "Rosa"],
  ["Sven Andersen", "Sven"], ["Tara O'Brien", "Tara"],
  ["Uma Thurston", "Uma"], ["Victor Reyes", "Victor"],
  ["Winnie Chow Yuen Ling", "Winnie"], ["Xander Kwan Hoe Loon", "Xander"],
  ["Yvette Fung Mei Kuan", "Yvette"], ["Zane Loh Ah Boy", "Zane"],
  ["Alicia Tham Siu Kwan", "Alicia"], ["Bobby Chia Kok Keong", "Bobby"],
  ["Cindy Yeap Sook Chin", "Cindy"], ["Dave Yip Wai Hong", "Dave"],
  ["Elaine Hor Mei Ling", "Elaine"], ["Frank Cham Chee Boon", "Frank"],
  ["Gwen Seow Hwee Leng", "Gwen"], ["Hector Kuan Chee Hong", "Hector"],
  ["Iris Choo Ah Lian", "Iris"], ["Jack Seng Kian Hoon", "Jack"],
];

// ─── Salary helper ────────────────────────────────────────────────
function salary(role: string): number {
  switch (role) {
    case "branch_manager": return 5000 + Math.floor(Math.random() * 2000);
    case "manager":        return 3500 + Math.floor(Math.random() * 1500);
    case "hostess":        return 800  + Math.floor(Math.random() * 400);
    case "driver":         return 2200 + Math.floor(Math.random() * 600);
    case "kitchen":        return 1800 + Math.floor(Math.random() * 700);
    default:               return 1800 + Math.floor(Math.random() * 600);
  }
}

function empType(role: string): string {
  return role === "hostess" ? "part_time" : "full_time";
}

function hireDate(): string {
  const start = new Date("2022-01-01").getTime();
  const end   = new Date("2025-12-01").getTime();
  const d = new Date(start + Math.random() * (end - start));
  return d.toISOString().split("T")[0]!;
}

function nationality(role: string, name: string): string {
  if (role === "driver") return "Malaysian";
  if (role === "kitchen") {
    if (/uddin|alam|karim|hossain|haque|rahman|islam|bhuiyan|jakir|aminul|belal|habibur|mofizul|shamsul|patwary/i.test(name)) return "Bangladeshi";
    if (/pillai|murugan|selva|arum|shan|kumar|perumal|gopal|bala|suppi|govind|sharma|vikram|suresh|deepak|pradeep|sanjay|ramesh|rajesh|anil|naresh|prakash|venkat|dinesh|santosh|ganesh|sunil|manoj|chandra|praveen|harish|rohit/i.test(name)) return "Indian";
    return "Malaysian";
  }
  if (role === "hostess") {
    if (/nguyen|tran|pham|hoang|le|vu|dang|bui|ly|duong|dinh|luong|trinh|ngo|dao|truong|luu|vo|chu/i.test(name)) return "Vietnamese";
    if (/petcharat|siriporn|waranya|natnicha|sirinapa|supanida|napaporn|thanida|wanphen|supamas|orathai|pennapa|nattaya|siriwan|pattama|siriphan|suwannee|suchada|nanthika|phatsara/i.test(name)) return "Thai";
    if (/santos|reyes|cruz|garcia|dela cruz|lopez|ramos|bautista|mendoza|aquino|villanueva|castro|domingo|fernandez|soriano|pascual|navarro|tolentino|panganiban|salazar/i.test(name)) return "Filipino";
    if (/rahayu|wulandari|permata|wijaya|kusuma|handayani|maharani|lestari|susanti|anggraini|natalia|astuti|pratiwi|sari kartika/i.test(name)) return "Indonesian";
    if (/kim|park|lee|choi|jung|shin|yoon|kwon|jang|oh|tanaka|sato|yamamoto|watanabe|nakamura|kobayashi|ito|kato|suzuki|hayashi/i.test(name)) return "Korean/Japanese";
    if (/aziz|razak|karim|yusof|ahmad|ismail|hamdan|osman|jamal|hassan|maimunah|daud|bakar|mansor|salleh|akmar|ghani|ibrahim|omar|mardhiah/i.test(name)) return "Malaysian";
    return "Chinese-Malaysian";
  }
  return "Malaysian";
}

// ─── Photo counters ───────────────────────────────────────────────
let femalePhotoIdx = 0;
let malePhotoIdx = 0;

function femalePhoto(): string {
  const n = femalePhotoIdx++ % 99;
  return `https://randomuser.me/api/portraits/women/${n}.jpg`;
}
function malePhoto(): string {
  const n = malePhotoIdx++ % 99;
  return `https://randomuser.me/api/portraits/men/${n}.jpg`;
}

// ─── Build staff rows ─────────────────────────────────────────────
interface StaffRow {
  branchId: string;
  code: string;
  fullName: string;
  legalName: string;
  nickname: string;
  role: string;
  empType: string;
  hireDate: string;
  salary: number;
  photo: string;
  nationality: string;
  phone: string;
}

function phone(): string {
  const prefix = ["011", "012", "013", "014", "016", "017", "018", "019"][Math.floor(Math.random() * 8)];
  const num = Math.floor(Math.random() * 90000000 + 10000000);
  return `+60${prefix}-${String(num).slice(0, 4)}-${String(num).slice(4, 8)}`;
}

function buildStaff(): StaffRow[] {
  const rows: StaffRow[] = [];
  let mgrIdx = 0, hstIdx = 0, genIdx = 0, drvIdx = 0, kthIdx = 0;
  let branchMgrSeq: Record<string, number> = {};

  for (const branch of BRANCHES) {
    if (!branchMgrSeq[branch.code]) branchMgrSeq[branch.code] = 0;

    const add = (namePool: [string, string][], poolIdx: number, role: string, isFirst: boolean) => {
      const [full, nick] = namePool[poolIdx % namePool.length]!;
      const actualRole = (role === "manager" && isFirst) ? "branch_manager" : role;
      const seq = ++branchMgrSeq[branch.code]!;
      const roleAbbr = { branch_manager: "MGR", manager: "MGR", hostess: "HST", driver: "DRV", kitchen: "KTH", general: "STF", hall: "STF" }[actualRole] ?? "STF";
      const photo = (role === "hostess") ? femalePhoto() : malePhoto();
      rows.push({
        branchId: branch.id,
        code: `${branch.code}-${roleAbbr}-${String(seq).padStart(3, "0")}`,
        fullName: full,
        legalName: full,
        nickname: nick,
        role: actualRole,
        empType: empType(actualRole),
        hireDate: hireDate(),
        salary: salary(actualRole),
        photo,
        nationality: nationality(role, full),
        phone: phone(),
      });
    };

    for (let i = 0; i < branch.mgr; i++) add(MANAGER_NAMES, mgrIdx++, "manager", i === 0);
    for (let i = 0; i < branch.hst; i++) add(HOSTESS_NAMES, hstIdx++, "hostess", false);
    for (let i = 0; i < branch.gen; i++) add(GENERAL_NAMES, genIdx++, "general", false);
    for (let i = 0; i < branch.drv; i++) add(DRIVER_NAMES, drvIdx++, "driver", false);
    for (let i = 0; i < branch.kth; i++) add(KITCHEN_NAMES, kthIdx++, "kitchen", false);
  }

  return rows;
}

// ─── Main ─────────────────────────────────────────────────────────
async function main() {
  const rows = buildStaff();
  console.log(`[seed-staff] Generating ${rows.length} staff members...`);

  let inserted = 0;
  let skipped = 0;

  for (const r of rows) {
    try {
      const res = await pool.query(
        `INSERT INTO staff (
          branch_id, employee_code, full_name, legal_name, phone,
          role, employment_type, hire_date, base_salary, salary_currency,
          profile_photo, nationality, is_active, notes
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'MYR',$10,$11,true,$12)
        ON CONFLICT (employee_code) DO NOTHING
        RETURNING id`,
        [
          r.branchId, r.code, r.fullName, r.legalName, r.phone,
          r.role, r.empType, r.hireDate, r.salary,
          r.photo, r.nationality,
          `Nickname: ${r.nickname}`,
        ],
      );
      if (res.rowCount && res.rowCount > 0) inserted++;
      else skipped++;
    } catch (err) {
      console.error(`  [error] ${r.code} ${r.fullName}:`, err);
    }
  }

  console.log(`[seed-staff] Done. Inserted: ${inserted}, Skipped (duplicate): ${skipped}`);
  console.log(`[seed-staff] Total staff in DB: ${(await pool.query("SELECT COUNT(*) FROM staff")).rows[0].count}`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
