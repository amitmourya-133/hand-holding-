import { Router } from 'express';
import mongoose from 'mongoose';
import { User } from '../models.js';
import { requireAuth } from '../auth.js';

const router = Router();
const oid = (id) => new mongoose.Types.ObjectId(String(id));

router.get('/', requireAuth, async (req, res) => {
  try {
    const { role } = req.user;

    if (role === 'mentee') {
      const menteeId = req.userId;

      // Find mentors matching criteria
      const match = await findMentorMatch(menteeId);

      return res.json({ match });
    }

    if (role === 'mentor') {
      const mentorId = req.userId;

      // Get mentees this mentor could be matched with
      const mentees = await findPotentialMentees(mentorId);

      return res.json({ mentees });
    }

    if (role === 'admin') {
      const matches = await getAllMatches();
      return res.json({ matches });
    }

    return res.json({ match: null, mentees: [] });
  } catch (err) {
    console.error('Mentor matching error:', err);
    res.status(500).json({ error: 'Could not compute mentor matches' });
  }
});

// --- Internal logic ---

async function findMentorMatch(menteeId) {
  const mentee = await User.findById(menteeId).select('department skills availability mentorType batch');
  if (!mentee) return null;

  const menteeSkills = new Set(mentee.skills || []);
  const menteeDept = mentee.department || '';
  const menteeAvailability = mentee.availability || 'available';

  // Build query for compatible mentors
  const query = {
    role: 'mentor',
    availability: menteeAvailability,
    mentorType: { $ne: '' },
  };

  // Filter by department if mentee has one
  if (menteeDept) {
    query.department = menteeDept;
  }

  // Find mentors with overlapping skills
  const mentors = await User.find(query).select('name department skills mentorType bio color availability');

  // Score and sort by skill overlap and department match
  const scored = mentors.map((m) => {
    const mentorSkills = new Set(m.skills || []);
    const skillOverlap = [...menteeSkills].filter((s) => mentorSkills.has(s)).length;
    const deptMatch = menteeDept && menteeDept === (m.department || '') ? 2 : 1;
    const totalSkills = menteeSkills.size + mentorSkills.size;
    const matchScore = skillOverlap + deptMatch;

    return {
      user: m.toPublic(),
      skillOverlap,
      departmentMatch: deptMatch,
      matchScore,
    };
  });

  // Sort by match score descending
  scored.sort((a, b) => b.matchScore - a.matchScore);

  // Return top 5 matches
  return scored.slice(0, 5).map((s) => ({
    ...s,
    mentorTypeLabel: { faculty: 'Faculty Mentor', alumni: 'Alumni Mentor', industry: 'Industry Mentor' }[s.user.mentorType] || s.user.mentorType,
  }));
}

async function findPotentialMentees(mentorId) {
  const mentor = await User.findById(mentorId).select('department skills availability mentorType');

  const query = {
    role: 'mentee',
    availability: { $ne: 'unavailable' },
  };

  if (mentor.department) {
    query.department = mentor.department;
  }

  const mentees = await User.find(query).select('name department skills batch bio color').limit(10);

  return mentees.map((m) => m.toPublic());
}

async function getAllMatches() {
  const mentees = await User.find({ role: 'mentee' }).select('name department skills availability');
  const mentors = await User.find({ role: 'mentor', availability: 'available' }).select('name department skills availability mentorType');

  const results = [];
  for (const mentee of mentees) {
    const menteeSkills = new Set(mentee.skills || []);
    const menteeDept = mentee.department || '';

    const matches = mentors
      .filter((m) => {
        const mentorSkills = new Set(m.skills || []);
        const hasSkillOverlap = [...menteeSkills].some((s) => mentorSkills.has(s));
        const deptMatch = menteeDept && menteeDept === (m.department || '');
        return hasSkillOverlap || deptMatch;
      })
      .map((m) => {
        const mentorSkills = new Set(m.skills || []);
        const skillOverlap = [...menteeSkills].filter((s) => mentorSkills.has(s)).length;
        const deptScore = menteeDept && menteeDept === (m.department || '') ? 2 : 1;
        return {
          mentee: { name: mentee.name, dept: menteeDept },
          mentor: { name: m.name, dept: m.department, mentorType: m.mentorType },
          skillOverlap,
          departmentMatch: deptScore,
        };
      });

    results.push({ mentee: mentee.name, matches });
  }

  return results;
}

export default router;