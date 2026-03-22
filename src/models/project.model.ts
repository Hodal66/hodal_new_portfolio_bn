import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IProject extends Document {
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  year: string;
  duration: string;
  status: string;
  role: string;
  team: string;
  description: string;
  overview: string;
  challenge: string;
  solution: string;
  // Localized fields
  titleFr?: string; titleSw?: string; titleRw?: string;
  subtitleFr?: string; subtitleSw?: string; subtitleRw?: string;
  categoryFr?: string; categorySw?: string; categoryRw?: string;
  descriptionFr?: string; descriptionSw?: string; descriptionRw?: string;
  overviewFr?: string; overviewSw?: string; overviewRw?: string;
  challengeFr?: string; challengeSw?: string; challengeRw?: string;
  solutionFr?: string; solutionSw?: string; solutionRw?: string;
  image: string; // Used for iconify icons
  gradient: string;
  tech: string[];
  architecture: { layer: string; tech: string }[];
  features: { title: string; description: string }[];
  metrics: Record<string, { value: string; label: string }>;
  lessons: string[];
  links: {
    github?: string;
    live?: string;
    demo?: string;
    docs?: string;
    company?: string;
  };
  featured: boolean;
  order: number;
}

const projectSchema: Schema<IProject> = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    subtitle: { type: String, trim: true },
    category: { type: String, trim: true },
    year: { type: String, trim: true },
    duration: { type: String, trim: true },
    status: { type: String, trim: true },
    role: { type: String, trim: true },
    team: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    overview: { type: String },
    challenge: { type: String },
    solution: { type: String },
    // Localized fields
    titleFr: String, titleSw: String, titleRw: String,
    subtitleFr: String, subtitleSw: String, subtitleRw: String,
    categoryFr: String, categorySw: String, categoryRw: String,
    descriptionFr: String, descriptionSw: String, descriptionRw: String,
    overviewFr: String, overviewSw: String, overviewRw: String,
    challengeFr: String, challengeSw: String, challengeRw: String,
    solutionFr: String, solutionSw: String, solutionRw: String,
    image: { type: String },
    gradient: { type: String },
    tech: [{ type: String }],
    architecture: [
      {
        layer: { type: String },
        tech: { type: String },
      },
    ],
    features: [
      {
        title: { type: String },
        description: { type: String },
      },
    ],
    metrics: {
      type: Map,
      of: new Schema({
        value: { type: String },
        label: { type: String },
      }, { _id: false }),
    },
    lessons: [{ type: String }],
    links: {
      github: { type: String, trim: true },
      live: { type: String, trim: true },
      demo: { type: String, trim: true },
      docs: { type: String, trim: true },
      company: { type: String, trim: true },
    },
    featured: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

projectSchema.statics.isProjectNameTaken = async function (title: string, excludeProjectId: string): Promise<boolean> {
  const project = await this.findOne({ title, _id: { $ne: excludeProjectId } });
  return !!project;
};

const Project = mongoose.model<IProject, Model<IProject>>('Project', projectSchema) as any;
export default Project;
