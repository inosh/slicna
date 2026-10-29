// Sample content shown until slicna-backend is live. Facts come from SLICNA's introduction deck
// and Facebook page; replace through the admin panel once the API exists.
const SLICNA_DEMO = {
  events: [
    { id: 'cpd-2026-01', title: 'Legal & Regulatory Framework for Nurse Managers: Ensuring Safe and Accountable Nursing Services', category: 'cpd', event_date: '2026-01-24', cpd_points: 6, location: 'Colombo', summary: 'The legal duties and regulations nurse managers work within, and how to run safe, accountable services.' },
    { id: 'cpd-2026-02', title: 'Professional Boundaries in Nursing Practice: Protecting Patients, Nurses, and the Profession', category: 'cpd', event_date: '2026-03-01', cpd_points: 6.5, location: 'NTC Auditorium, Colombo', summary: 'Where the line sits between caring and over-involvement, and how to hold it.' },
    { id: 'cpd-2026-03', title: "Nurses' Professional Identity and the Impact of Institutional & Financial Regulations: Needs and Safeguarding", category: 'cpd', event_date: '2026-03-28', cpd_points: 6.5, location: 'Colombo', summary: 'How institutional and financial rules shape the nursing role, and how to safeguard it.' },
    { id: 'cpd-2026-04', title: 'Nursing Approaches to Nutritional Management in Chronic Kidney Disease', category: 'cpd', event_date: '2026-05-23', cpd_points: 6.5, location: 'Colombo', summary: 'Evidence-based nutritional care for patients with chronic kidney disease.' },
    { id: 'cpd-2026-05', title: 'Advanced Workshop on Nursing Governance and Professional Accountability', category: 'cpd', event_date: '2026-06-14', cpd_points: 6, location: 'Colombo', summary: 'Governance structures, accountability and leadership for senior nurses.' },
    { id: 'cpd-2026-06', title: 'Effective Communication Skills for Professional Nurses', category: 'cpd', event_date: '2026-06-14', cpd_points: 4, location: 'Colombo', summary: 'Clear communication with patients, families and the critical care team.' },
    { id: 'cpd-2026-07', title: 'AI for Nurses: Enhancing Patient Care through Intelligent Tools', category: 'cpd', event_date: '2026-07-18', cpd_points: 6.5, location: 'Colombo', summary: 'Practical, safe uses of AI tools in everyday nursing work.' },
    { id: 'cpd-2026-08', title: 'Advancing Infection Prevention and Control: Evidence-Based Nursing Practices for Safer Patient Care', category: 'international', event_date: '2026-08-29', time: '8.00 a.m. – 4.00 p.m.', cpd_points: 6.5, location: 'New Auditorium, Lady Ridgeway Hospital for Children, Colombo', summary: 'An international CPD workshop held with critical care and infection control nursing bodies from the region.', photo_url: '/images/infection-control-workshop.jpg' },
    { id: 'cpd-2026-09', title: 'Stress Management for Nursing Professionals: Building Resilience and Well-being', category: 'cpd', event_date: '2026-09-12', cpd_points: 5, location: 'Colombo', summary: 'Recognising stress in high-acuity work and building lasting resilience.' },
    { id: 'walk-2026', title: 'World Diabetes Day Celebration Walk', category: 'community', event_date: '2026-11-17', location: 'Kotawa → Maharagama', summary: 'A public awareness walk for World Diabetes Day. Walk with us, and help spread the word.', photo_url: '/images/diabetes-walk.jpg' },
    { id: 'cyber-2026', title: 'Cyber Security – Practical Workshop', category: 'cpd', event_date: '2026-11-28', location: 'To be announced', summary: 'A hands-on CPD workshop on staying safe with patient data, devices and online accounts.', registration_open: true }
  ],

  news: [
    { id: 'iconic-award', title: 'SLICNA named Best Professional Association of the Year', published_at: '2026-02-20', photo_url: '/images/iconic-award.jpg', summary: 'SLICNA received the ICONIC Award for the Best Professional Association of the Year in Sri Lanka.', body: '<p>SLICNA has been recognised with the ICONIC Award for the Best Professional Association of the Year in Sri Lanka.</p><p>The award reflects the work of our members and volunteers: a full calendar of accredited CPD programmes, international workshops, and health promotion in schools and the media.</p>' },
    { id: 'infection-control-2026', title: 'International workshop on infection prevention and control', published_at: '2026-08-30', photo_url: '/images/infection-control-workshop.jpg', summary: 'Nurses from Sri Lanka and the region met at Lady Ridgeway Hospital for a full-day CPD workshop on evidence-based infection control.', body: '<p>SLICNA hosted an international CPD workshop, <em>Advancing Infection Prevention and Control</em>, on 29 August 2026 at the New Auditorium of Lady Ridgeway Hospital for Children.</p><p>The programme was organised with partner nursing bodies from the region and carried 6.5 CPD points.</p>' },
    { id: 'slicna-award-2025', title: 'SLICNA Award 2025 honours excellence in nursing', published_at: '2025-12-15', photo_url: '/images/award-ceremony.jpg', summary: 'Our annual award ceremony recognised nurses whose work sets the standard for critical care in Sri Lanka.', body: '<p>The SLICNA Award 2025 recognised nurses for excellence in practice, leadership and education.</p>' },
    { id: 'talent-show-2026', title: 'SLICNA Talent Show: meet the final 12', published_at: '2026-02-10', photo_url: '/images/cpd-audience.jpg', summary: "Twelve finalists made it through to the final of SLICNA's first talent show for nurses.", body: '<p>Twelve finalists reached the final of the SLICNA Talent Show, celebrating the talent of nurses beyond the bedside.</p>' },
    { id: 'radio-awareness', title: 'On air: SLICNA nurses talk health on national radio', published_at: '2026-06-02', photo_url: '/images/radio-awareness.jpg', summary: 'Our members joined radio programmes to share practical health advice with the public.', body: '<p>SLICNA members have taken part in radio health programmes, sharing practical advice on preventing illness and recognising warning signs early.</p>' }
  ],

  committee: {
    members: [
      { slot_key: 'president', role_title: 'President', name: '', designation: '' },
      { slot_key: 'vice-president', role_title: 'Vice President', name: '', designation: '' },
      { slot_key: 'secretary', role_title: 'Secretary', name: '', designation: '' },
      { slot_key: 'assistant-secretary', role_title: 'Assistant Secretary', name: '', designation: '' },
      { slot_key: 'treasurer', role_title: 'Treasurer', name: '', designation: '' },
      { slot_key: 'assistant-treasurer', role_title: 'Assistant Treasurer', name: '', designation: '' },
      { slot_key: 'editor', role_title: 'Editor', name: '', designation: '' },
      { slot_key: 'education-coordinator', role_title: 'Education Coordinator', name: '', designation: '' }
    ]
  },

  albums: [
    { id: 'award-2025', title: 'SLICNA Award 2025', cover_photo: '/images/award-ceremony.jpg', photos: [{ url: '/images/award-ceremony.jpg', caption: 'Annual Award Ceremony 2025' }, { url: '/images/iconic-award.jpg', caption: 'ICONIC Award – Best Professional Association' }] },
    { id: 'cpd', title: 'CPD programmes', cover_photo: '/images/cpd-audience.jpg', photos: [{ url: '/images/cpd-audience.jpg', caption: 'A full house at a CPD programme' }, { url: '/images/team.png', caption: 'The SLICNA team' }] },
    { id: 'school-health', title: 'School Health Programme', cover_photo: '/images/school-health.jpg', photos: [{ url: '/images/school-health.jpg', caption: 'Emergency response training for students' }, { url: '/images/school-1.jpg', caption: 'First aid demonstration' }, { url: '/images/school-2.jpg', caption: 'Certificates for participating students' }] },
    { id: 'awareness', title: 'Public awareness', cover_photo: '/images/radio-awareness.jpg', photos: [{ url: '/images/radio-awareness.jpg', caption: 'Health talk on radio' }, { url: '/images/suwa-diviya.jpg', caption: 'Suwa Diviya health programme' }, { url: '/images/diabetes-walk.jpg', caption: 'World Diabetes Day walk 2026' }, { url: '/images/childrens-day.jpg', caption: "Children's Day programme" }] }
  ],

  fees: [
    { key: 'ordinary', label: 'Ordinary member', amount: null, period: 'year' },
    { key: 'life', label: 'Life member', amount: null, period: 'one-time' },
    { key: 'associate', label: 'Associate member', amount: null, period: 'year' }
  ]
};
