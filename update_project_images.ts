import mongoose from 'mongoose';
import { config } from './src/config';
import Project from './src/models/project.model';

const projectImages = [
  { slug: 'ihuze-mentorship-platform', image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80&w=1200' },
  { slug: 'enterprise-admin-dashboard', image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=1200' },
  { slug: 'it-infrastructure-lab', image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc48?auto=format&fit=crop&q=80&w=1200' },
  { slug: 'google-sheets-api-integration', image: 'https://images.unsplash.com/photo-1586281380117-5a60ae2050cc?auto=format&fit=crop&q=80&w=1200' },
  { slug: 'travel-services-platform', image: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&q=80&w=1200' },
  { slug: 'timtom-aviation-training-portal', image: 'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&q=80&w=1200' }
];

async function updateImages() {
  try {
    await mongoose.connect(config.mongoose.url);
    console.log('Connected to DB');

    for (const item of projectImages) {
      const project = await Project.findOne({ slug: item.slug });
      if (!project) {
        console.log(`Project with slug ${item.slug} not found`);
        continue;
      }

      project.image = item.image;
      await project.save();
      console.log(`Updated ${item.slug} with Stunning Unsplash Visual`);
    }

    console.log('All images updated with high-end placeholders!');
    process.exit(0);
  } catch (err) {
    console.error('Update failed:', err);
    process.exit(1);
  }
}

updateImages();
