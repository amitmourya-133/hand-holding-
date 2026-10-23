import mongoose from 'mongoose';

const { Schema, model, Types } = mongoose;

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['mentee', 'mentor', 'admin'], default: 'mentee' },
    mentorType: { type: String, enum: ['faculty', 'alumni', 'industry', ''], default: '' },
    department: { type: String, default: '' },
    batch: { type: String, default: '' },
    company: { type: String, default: '' },
    designation: { type: String, default: '' },
    skills: { type: [String], default: [] },
    bio: { type: String, default: '' },
    color: { type: String, default: '#4f6df5' },
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },
    availability: { type: String, enum: ['available', 'limited', 'unavailable'], default: 'available' },
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    lastActiveAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.methods.toPublic = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    mentorType: this.mentorType,
    department: this.department,
    batch: this.batch,
    company: this.company,
    designation: this.designation,
    skills: this.skills,
    bio: this.bio,
    color: this.color,
    availability: this.availability,
    ratingAvg: this.ratingAvg,
    ratingCount: this.ratingCount,
    createdAt: this.createdAt,
  };
};

const connectionSchema = new Schema(
  {
    mentee: { type: Types.ObjectId, ref: 'User', required: true },
    mentor: { type: Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);
connectionSchema.index({ mentee: 1, mentor: 1 }, { unique: true });

const conversationSchema = new Schema(
  {
    pairKey: { type: String, required: true, unique: true },
    participants: [{ type: Types.ObjectId, ref: 'User' }],
    lastMessage: {
      text: { type: String, default: '' },
      sender: { type: Types.ObjectId, ref: 'User' },
      at: { type: Date },
    },
    unread: { type: Object, default: {} },
  },
  { timestamps: true }
);
conversationSchema.index({ participants: 1 });

const messageSchema = new Schema(
  {
    conversation: { type: Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true },
    readBy: [{ type: Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);
messageSchema.index({ conversation: 1, createdAt: 1 });

const meetingSchema = new Schema(
  {
    mentor: { type: Types.ObjectId, ref: 'User', required: true },
    mentee: { type: Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    agenda: { type: String, default: '' },
    date: { type: Date, required: true },
    durationMin: { type: Number, default: 30 },
    mode: { type: String, enum: ['online', 'in_person'], default: 'online' },
    placeOrLink: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'completed', 'cancelled'],
      default: 'pending',
    },
    proposedBy: { type: Types.ObjectId, ref: 'User', required: true },
    reminderSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);
meetingSchema.index({ mentor: 1, date: 1 });
meetingSchema.index({ mentee: 1, date: 1 });

const goalSchema = new Schema(
  {
    mentee: { type: Types.ObjectId, ref: 'User', required: true },
    mentor: { type: Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    dueDate: { type: Date },
    status: { type: String, enum: ['not_started', 'in_progress', 'completed'], default: 'not_started' },
  },
  { timestamps: true }
);
goalSchema.index({ mentee: 1, mentor: 1 });

const feedbackSchema = new Schema(
  {
    meeting: { type: Types.ObjectId, ref: 'Meeting', required: true },
    mentee: { type: Types.ObjectId, ref: 'User', required: true },
    mentor: { type: Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, default: '' },
  },
  { timestamps: true }
);
feedbackSchema.index({ meeting: 1, mentee: 1 }, { unique: true });

const notificationSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['message', 'meeting', 'connection', 'goal', 'feedback', 'reminder'], default: 'info' },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    link: { type: String, default: '' },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);
notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

export const User = model('User', userSchema);
export const Connection = model('Connection', connectionSchema);
export const Conversation = model('Conversation', conversationSchema);
export const Message = model('Message', messageSchema);
export const Meeting = model('Meeting', meetingSchema);
export const Goal = model('Goal', goalSchema);
export const Feedback = model('Feedback', feedbackSchema);
export const Notification = model('Notification', notificationSchema);

export const Question = model('Question', new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  subject: { type: String, trim: true },
  status: { type: String, enum: ['open', 'answered', 'solved'], default: 'open' },
  acceptedAnswer: { type: Schema.Types.ObjectId, ref: 'Answer' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
},
{ timestamps: true })
);

export const Answer = model('Answer', new Schema({
  question: { type: Schema.Types.ObjectId, ref: 'Question', required: true },
  mentor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
},
{ timestamps: true })
);
