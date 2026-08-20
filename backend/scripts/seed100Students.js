/**
 * Seed 100 Random Students Script — School Management System
 * Generates 100 realistic Indian student records with father/mother names,
 * phone numbers, admission dates in early/mid 2026, categories, and monthly fee rates.
 */

const db = require('../src/config/db');

const FIRST_NAMES_BOYS = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ishan', 'Shaurya', 'Rohan',
  'Kabir', 'Kunal', 'Dev', 'Yash', 'Krishna', 'Shivam', 'Amit', 'Rohit', 'Ayush', 'Manish',
  'Vikram', 'Alok', 'Deepak', 'Rahul', 'Nikhil', 'Abhinav', 'Harsh', 'Siddharth', 'Pranav', 'Gaurav'
];

const FIRST_NAMES_GIRLS = [
  'Ananya', 'Diya', 'Saanvi', 'Aadhya', 'Pari', 'Anika', 'Navya', 'Avani', 'Myra', 'Priya',
  'Sneha', 'Pooja', 'Riya', 'Neha', 'Swati', 'Kavita', 'Aarti', 'Simran', 'Divya', 'Shreya',
  'Kirti', 'Megha', 'Tanvi', 'Isha', 'Muskan', 'Sonam', 'Jyoti', 'Kavya', 'Ruchi', 'Bhavna'
];

const LAST_NAMES = [
  'Sharma', 'Verma', 'Singh', 'Kumar', 'Gupta', 'Yadav', 'Mishra', 'Jha', 'Joshi', 'Chaudhary',
  'Agarwal', 'Pandey', 'Thakur', 'Mehta', 'Sinha', 'Tiwari', 'Rajput', 'Tripathi', 'Shukla', 'Dubey'
];

const FATHER_NAMES = [
  'Rajesh', 'Ramesh', 'Suresh', 'Anil', 'Sunil', 'Manoj', 'Sanjay', 'Vijay', 'Ajay', 'Alok',
  'Vinod', 'Dinesh', 'Rakesh', 'Mahesh', 'Mukesh', 'Ashok', 'Satish', 'Deepak', 'Praveen', 'Santosh',
  'Ramchhabila', 'Dharmendra', 'Surendra', 'Birendra', 'Rajendra', 'Shailendra', 'Nagendra', 'Upendra', 'Gajendra', 'Jitendra'
];

const MOTHER_NAMES = [
  'Sunita', 'Anita', 'Rekha', 'Manju', 'Seema', 'Geeta', 'Radha', 'Suman', 'Meena', 'Asha',
  'Savitri', 'Shanti', 'Pushpa', 'Vimla', 'Kousalya', 'Shakuntala', 'Usha', 'Sarita', 'Shobha', 'Sushma',
  'Sumitra', 'Kavita', 'Sangita', 'Pratibha', 'Urmila', 'Rajkumari', 'Geetanjali', 'Kamlesh', 'Sharda', 'Shakuntala'
];

const CITIES = [
  'Patna', 'Muzaffarpur', 'Gaya', 'Bhagalpur', 'Darbhanga', 'Purnia', 'Ara', 'Begusarai', 'Katihar', 'Chhapra'
];

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomDate2026() {
  // Random admission date between Jan 5, 2026 and Aug 15, 2026
  const start = new Date(2026, 0, 5).getTime(); // Jan 5, 2026
  const end = new Date(2026, 7, 15).getTime();  // Aug 15, 2026
  const randomTime = start + Math.random() * (end - start);
  const d = new Date(randomTime);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function seedStudents() {
  console.log('🚀 Starting seeding of 100 random students for 2026...');

  try {
    // 1. Fetch available classes and sections
    const classes = await db.query('SELECT `id` FROM `classes` ORDER BY `id` ASC');
    if (!classes || classes.length === 0) {
      console.error('❌ No classes found! Please ensure classes exist in database.');
      process.exit(1);
    }

    const sections = await db.query('SELECT `id`, `class_id` FROM `sections` ORDER BY `id` ASC');

    const classSectionMap = {};
    for (const c of classes) {
      classSectionMap[c.id] = sections.filter((s) => s.class_id === c.id).map((s) => s.id);
    }

    let insertedCount = 0;

    for (let i = 1; i <= 100; i++) {
      const isBoy = Math.random() > 0.45;
      const firstName = isBoy ? getRandomElement(FIRST_NAMES_BOYS) : getRandomElement(FIRST_NAMES_GIRLS);
      const lastName = getRandomElement(LAST_NAMES);
      const fullName = `${firstName} ${lastName}`;

      const fatherName = `${getRandomElement(FATHER_NAMES)} ${lastName}`;
      const motherName = `${getRandomElement(MOTHER_NAMES)} ${lastName}`;

      const admNo = `ADM-2026-${String(i).padStart(3, '0')}`;
      const phoneNum = `98${Math.floor(1000007 + Math.random() * 8999990)}`;

      // Category: ~70% day_scholar, ~30% hosteller
      const category = Math.random() > 0.3 ? 'day_scholar' : 'hosteller';
      const monthlyRate = category === 'hosteller' ? (Math.random() > 0.5 ? 5000 : 5500) : (Math.random() > 0.5 ? 3000 : 3500);

      // Random class and section
      const targetClass = getRandomElement(classes);
      const availableSections = classSectionMap[targetClass.id] || [];
      const targetSectionId = availableSections.length > 0 ? getRandomElement(availableSections) : null;

      const admissionDate = getRandomDate2026();
      const city = getRandomElement(CITIES);
      const address = `House No. ${Math.floor(10 + Math.random() * 150)}, ${city}, Bihar`;

      await db.query(
        `INSERT INTO \`students\`
         (\`admission_no\`, \`full_name\`, \`class_id\`, \`section_id\`, \`category\`, \`father_name\`, \`mother_name\`, \`parent_name\`, \`phone\`, \`whatsapp_number\`, \`address\`, \`admission_date\`, \`monthly_fee_rate\`, \`status\`)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        [
          admNo,
          fullName,
          targetClass.id,
          targetSectionId,
          category,
          fatherName,
          motherName,
          fatherName,
          phoneNum,
          phoneNum,
          address,
          admissionDate,
          monthlyRate,
        ]
      );

      insertedCount++;
    }

    console.log('===========================================================');
    console.log(`🎉 SUCCESS! Seeded ${insertedCount} random student records into 2026!`);
    console.log('===========================================================');
  } catch (err) {
    console.error('❌ Error seeding students:', err);
  } finally {
    await db.closePool();
    process.exit(0);
  }
}

seedStudents();
