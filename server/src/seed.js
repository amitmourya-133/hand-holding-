import bcrypt from 'bcryptjs';
import {
  User,
  Connection,
  Conversation,
  Message,
  Meeting,
  Goal,
  Feedback,
  Notification,
} from './models.js';

const PASSWORD = 'password123';

export async function seed() {
  console.log('[seed] Creating demo data...');
  const hash = await bcrypt.hash(PASSWORD, 10);

  const [admin, faculty, alumni, industry, s1, s2, s3] = await User.create([
    {
      name: 'Admin Office',
      email: 'admin@srms.edu',
      passwordHash: hash,
      role: 'admin',
      department: 'Administration',
      color: '#2c3e50',
    },
    {
      name: 'Dr. Anjali Verma',
      email: 'faculty@srms.edu',
      passwordHash: hash,
      role: 'mentor',
      mentorType: 'faculty',
      department: 'Computer Science',
      designation: 'Associate Professor',
      skills: ['Data Structures', 'Machine Learning', 'Research Guidance'],
      bio: 'Mentoring students on academics, projects and higher studies for 12+ years.',
      color: '#4f6df5',
      ratingAvg: 4.5,
      ratingCount: 2,
    },
    {
      name: 'Rahul Sharma',
      email: 'alumni@srms.edu',
      passwordHash: hash,
      role: 'mentor',
      mentorType: 'alumni',
      batch: '2018',
      department: 'Information Technology',
      company: 'TCS',
      designation: 'Senior Engineer',
      skills: ['Career Planning', 'Interview Prep', 'Web Development'],
      bio: 'SRMS alumnus helping students with placements and career decisions.',
      color: '#18a999',
      ratingAvg: 4,
      ratingCount: 1,
    },
    {
      name: 'Priya Nair',
      email: 'industry@srms.edu',
      passwordHash: hash,
      role: 'mentor',
      mentorType: 'industry',
      company: 'Google',
      designation: 'Software Engineer',
      skills: ['System Design', 'Internships', 'Open Source'],
      bio: 'Industry mentor for practical skills, internships and placement preparation.',
      color: '#e8595c',
      ratingAvg: 0,
      ratingCount: 0,
    },
    {
      name: 'Amit Shishupal',
      email: 'amit@srms.edu',
      passwordHash: hash,
      role: 'mentee',
      department: 'Computer Science',
      batch: '2027',
      bio: 'Final year student focusing on placements and a capstone project.',
      color: '#f0932b',
    },
    {
      name: 'Insha Khan',
      email: 'insha@srms.edu',
      passwordHash: hash,
      role: 'mentee',
      department: 'Information Technology',
      batch: '2027',
      color: '#8e44ad',
    },
    {
      name: 'Nirdesh Patel',
      email: 'nirdesh@srms.edu',
      passwordHash: hash,
      role: 'mentee',
      department: 'Computer Science',
      batch: '2028',
      color: '#16a085',
    },
  ]);

  const connections = await Connection.create([
    { mentee: s1._id, mentor: faculty._id, status: 'accepted', note: 'Need guidance on final year project.' },
    { mentee: s1._id, mentor: alumni._id, status: 'accepted', note: 'Placement preparation.' },
    { mentee: s2._id, mentor: alumni._id, status: 'accepted', note: 'Career direction in IT.' },
    { mentee: s3._id, mentor: faculty._id, status: 'pending', note: 'Want help with DBMS and projects.' },
    { mentee: s3._id, mentor: industry._id, status: 'pending', note: 'Interested in internships and open source.' },
  ]);

  const conv1 = await Conversation.create({
    pairKey: [String(s1._id), String(faculty._id)].sort().join('_'),
    participants: [s1._id, faculty._id],
    unread: { [String(faculty._id)]: 0 },
  });
  const conv2 = await Conversation.create({
    pairKey: [String(s1._id), String(alumni._id)].sort().join('_'),
    participants: [s1._id, alumni._id],
    unread: { [String(alumni._id)]: 1 },
    lastMessage: { text: 'Thanks! I will practice 5 problems a day.', sender: s1._id, at: new Date() },
  });

  await Message.create([
    { conversation: conv1._id, sender: s1._id, text: 'Good morning sir, I need help choosing a topic for my major project.', readBy: [s1._id, faculty._id] },
    { conversation: conv1._id, sender: faculty._id, text: 'Sure. Are you more interested in web development or machine learning?', readBy: [s1._id, faculty._id] },
    { conversation: conv1._id, sender: s1._id, text: 'Web development, preferably something with real users.', readBy: [s1._id, faculty._id] },
    { conversation: conv2._id, sender: alumni._id, text: 'Start with 2 DSA problems daily and revise core subjects every weekend.', readBy: [alumni._id] },
    { conversation: conv2._id, sender: s1._id, text: 'Thanks! I will practice 5 problems a day.', readBy: [s1._id] },
  ]);

  conv1.lastMessage = { text: 'Web development, preferably something with real users.', sender: s1._id, at: new Date() };
  await conv1.save();

  const inOneHour = new Date(Date.now() + 60 * 60 * 1000);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [mUpcoming, mPending, mCompleted, mCompletedAlumni] = await Meeting.create([
    {
      mentor: faculty._id,
      mentee: s1._id,
      title: 'Project topic discussion',
      agenda: 'Shortlist two project ideas and define the scope for the next month.',
      date: inOneHour,
      durationMin: 30,
      mode: 'online',
      placeOrLink: 'https://meet.google.com/demo-link',
      status: 'accepted',
      proposedBy: s1._id,
    },
    {
      mentor: alumni._id,
      mentee: s1._id,
      title: 'Mock placement interview',
      agenda: 'Resume review plus 30 minute technical mock interview.',
      date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      durationMin: 45,
      mode: 'online',
      placeOrLink: 'https://zoom.us/j/demo',
      status: 'pending',
      proposedBy: alumni._id,
    },
    {
      mentor: faculty._id,
      mentee: s1._id,
      title: 'Weekly progress check-in',
      agenda: 'Reviewed DBMS unit test results and DSA practice.',
      date: yesterday,
      durationMin: 30,
      mode: 'in_person',
      placeOrLink: 'Faculty Cabin 204',
      status: 'completed',
      proposedBy: faculty._id,
    },
    {
      mentor: alumni._id,
      mentee: s1._id,
      title: 'Resume review session',
      agenda: 'Reviewed resume, LinkedIn and shortlisted companies.',
      date: lastWeek,
      durationMin: 30,
      mode: 'online',
      placeOrLink: 'https://zoom.us/j/demo2',
      status: 'completed',
      proposedBy: s1._id,
    },
  ]);

  await Goal.create([
    {
      mentee: s1._id,
      mentor: faculty._id,
      title: 'Finish project proposal document',
      description: 'Write problem statement, modules and tech stack for approval.',
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      status: 'in_progress',
    },
    {
      mentee: s1._id,
      mentor: faculty._id,
      title: 'Complete DBMS normalization module',
      status: 'completed',
    },
    {
      mentee: s1._id,
      mentor: alumni._id,
      title: 'Solve 50 DSA problems',
      description: 'Arrays, strings and linked lists before the mock interview.',
      dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      status: 'in_progress',
    },
    {
      mentee: s2._id,
      mentor: alumni._id,
      title: 'Update resume and LinkedIn profile',
      status: 'not_started',
    },
  ]);

  await Feedback.create([
    {
      meeting: mCompleted._id,
      mentee: s1._id,
      mentor: faculty._id,
      rating: 5,
      comment: 'Very helpful session. The checklist for the project proposal made things clear.',
    },
    {
      meeting: mCompletedAlumni._id,
      mentee: s1._id,
      mentor: alumni._id,
      rating: 4,
      comment: 'Good advice on resume structure and shortlisting companies.',
    },
  ]);

  await Notification.create([
    {
      user: s1._id,
      type: 'connection',
      title: 'Mentorship request accepted',
      body: 'Dr. Anjali Verma is now your mentor. You can start a conversation.',
      link: '/connections',
    },
    {
      user: faculty._id,
      type: 'meeting',
      title: 'New meeting proposal',
      body: '"Project topic discussion" proposed for ' + inOneHour.toLocaleString(),
      link: '/meetings',
      read: true,
    },
    {
      user: s3._id,
      type: 'message',
      title: 'Reminder: update your skills',
      body: 'Add the courses you are currently pursuing to your profile.',
      link: '/profile',
    },
  ]);

  console.log('[seed] Done. Demo accounts (password for all: password123):');
  console.log('  admin@srms.edu, faculty@srms.edu, alumni@srms.edu, industry@srms.edu');
  console.log('  amit@srms.edu, insha@srms.edu, nirdesh@srms.edu');
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  const { connectDB, disconnectDB } = await import('./db.js');
  try {
    await connectDB();
  } catch (err) {
    console.error('[seed] Could not connect to database:', err && err.message ? err.message : err);
    process.exit(1);
  }
  try {
    const count = await User.countDocuments();
    if (count > 0) {
      console.log('[seed] Database already has users, skipping. Delete the DB to re-seed.');
    } else {
      await seed();
    }
  } finally {
    await disconnectDB();
  }
}
