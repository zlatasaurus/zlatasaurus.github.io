// All site copy lives here. Add/rename/reorder topics freely; the list, the
// times beside them and the routes (#/<id>) are generated from this array.
//
// photos: paths relative to the site root, e.g. 'assets/photos/about/me.jpg'

export const SITE = {
  title: "Zlata's Portfolio",
  tagline: 'creating systems in oddity',
  finePrint:
    '© 2025 Zlata. All rights reserved. Designed and built by hand with three.js. Scroll to move through the day.',
};

export const TOPICS = [
  { id: 'about',       name: 'About',       tag: '[ ft. Zlata ]',  body: 'A few words about who I am, what I care about and how I work.', photos: [] },
  { id: 'projects',    name: 'Projects',    tag: '',               body: 'Selected work: things I built, shipped and learned from.',       photos: [] },
  { id: 'design',      name: 'Design',      tag: '[ ft. Figma ]',  body: 'Interfaces, identities and visual experiments.',                 photos: [] },
  { id: 'writing',     name: 'Writing',     tag: '',               body: 'Essays, notes and case studies.',                                photos: [] },
  { id: 'experiments', name: 'Experiments', tag: '[ ft. WebGL ]',  body: 'Small, strange prototypes made for fun.',                        photos: [] },
  { id: 'photography', name: 'Photography', tag: '',               body: 'Frames from the in-between hours.',                              photos: [] },
  { id: 'resume',      name: 'Resume',      tag: '',               body: 'Experience, education and skills.',                              photos: [] },
  { id: 'contact',     name: 'Contact',     tag: '[ ft. You ]',    body: 'Say hello — I would love to hear from you.',                     photos: [] },
  { id: 'play',        name: 'Play',        tag: '[ ft. a Ball ]', body: '', photos: [], isGame: true },
];
