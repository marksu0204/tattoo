import { Artwork, ArtworkStatus, Appointment, User, UserRole } from './types';

export const INITIAL_ARTWORKS: Artwork[] = [
  {
    id: '1',
    title: 'Eternal Rose',
    description: 'A delicate black and grey rose with geometric accents. Suitable for forearm or calf.',
    imageUrl: 'https://picsum.photos/id/64/800/800', // Placeholder
    category: 'Flower',
    status: ArtworkStatus.AVAILABLE,
    price: 3500,
    createdAt: new Date().toISOString(),
    tags: ['rose', 'blackwork', 'geometric'],
  },
  {
    id: '2',
    title: 'Wolf Spirit',
    description: 'Fierce wolf head with traditional shading techniques.',
    imageUrl: 'https://picsum.photos/id/237/800/800',
    category: 'Animal',
    status: ArtworkStatus.CLAIMED, // Cannot be booked
    price: 5000,
    createdAt: new Date().toISOString(),
    tags: ['wolf', 'animal', 'traditional'],
  },
  {
    id: '3',
    title: 'Minimalist Lines',
    description: 'Abstract flowing lines representing water.',
    imageUrl: 'https://picsum.photos/id/34/800/800',
    category: 'Line Work',
    status: ArtworkStatus.AVAILABLE,
    price: 2000,
    createdAt: new Date().toISOString(),
    tags: ['abstract', 'linework', 'minimal'],
  },
  {
    id: '4',
    title: 'Sacred Geometry',
    description: 'Complex mandala pattern.',
    imageUrl: 'https://picsum.photos/id/134/800/800',
    category: 'Geometry',
    status: ArtworkStatus.AVAILABLE,
    price: 6000,
    createdAt: new Date().toISOString(),
    tags: ['mandala', 'geometric', 'dotwork'],
  },
];

export const INITIAL_APPOINTMENTS: Appointment[] = [
  {
    id: 'apt-1',
    date: new Date().toISOString().split('T')[0],
    timeSlot: '14:00',
    status: 'OPEN'
  },
  {
    id: 'apt-2',
    date: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
    timeSlot: '16:00',
    status: 'BOOKED',
    userId: 'user-1',
    customerName: 'Alice Chen',
    notes: 'Wolf tattoo consultation'
  }
];

export const MOCK_LINE_USER: User = {
  id: 'line-user-123',
  name: 'Line User',
  role: UserRole.MEMBER,
  avatarUrl: 'https://picsum.photos/id/64/100/100'
};