// Built-in story library for Story Sync.
// Each story has segments; each segment has facts and may have distractors.

export type StoryFact = { label: string; value: string; is_distractor?: boolean };
export type StorySegment = { index: number; text: string; facts: StoryFact[] };
export type Story = {
  id: string;
  difficulty: 1 | 2 | 3 | 4;
  title: string;
  segments: StorySegment[]; // up to 6 (max group size)
};

// A small but complete starter library. The facilitator can reuse stories, the
// app picks segments equal to participant count and avoids same-story repeats.
export const STORY_LIBRARY: Story[] = [
  {
    id: "l1-bakery",
    difficulty: 1,
    title: "The Morning Bakery",
    segments: [
      {
        index: 0,
        text: "At 6 AM, Maria opened the bakery on Oak Street. She lit two ovens and put on a blue apron.",
        facts: [
          { label: "Time", value: "6 AM" },
          { label: "Owner", value: "Maria" },
          { label: "Street", value: "Oak Street" },
          { label: "Apron color", value: "blue" },
        ],
      },
      {
        index: 1,
        text: "She baked 30 croissants and 12 loaves of sourdough bread before the doors opened at 7 AM.",
        facts: [
          { label: "Croissants", value: "30" },
          { label: "Loaves", value: "12 sourdough" },
          { label: "Open time", value: "7 AM" },
        ],
      },
      {
        index: 2,
        text: "The first customer was Mr. Chen, who bought four croissants and a black coffee.",
        facts: [
          { label: "First customer", value: "Mr. Chen" },
          { label: "Croissants bought", value: "4" },
          { label: "Drink", value: "black coffee" },
        ],
      },
      {
        index: 3,
        text: "By noon, Maria had sold every loaf and was calling her supplier to order more flour for tomorrow.",
        facts: [
          { label: "Sold out time", value: "noon" },
          { label: "Sold out item", value: "loaves" },
          { label: "Order item", value: "flour" },
        ],
      },
      {
        index: 4,
        text: "She locked the bakery at 4 PM and walked her dog Rex through the park before heading home.",
        facts: [
          { label: "Close time", value: "4 PM" },
          { label: "Dog name", value: "Rex" },
          { label: "After-work activity", value: "walked the dog" },
        ],
      },
      {
        index: 5,
        text: "That night Maria wrote down a new recipe for cinnamon rolls she planned to try on Saturday.",
        facts: [
          { label: "New recipe", value: "cinnamon rolls" },
          { label: "Trial day", value: "Saturday" },
        ],
      },
    ],
  },
  {
    id: "l1-zoo",
    difficulty: 1,
    title: "School Trip to the Zoo",
    segments: [
      { index: 0, text: "On Tuesday, Mrs. Akin took 22 students to the city zoo on a yellow bus.", facts: [{ label: "Day", value: "Tuesday" }, { label: "Teacher", value: "Mrs. Akin" }, { label: "Students", value: "22" }, { label: "Bus color", value: "yellow" }] },
      { index: 1, text: "They saw three lions sleeping under a tree near the main entrance.", facts: [{ label: "Lions", value: "3" }, { label: "Activity", value: "sleeping" }, { label: "Location", value: "near main entrance" }] },
      { index: 2, text: "At 11 AM the group ate lunch by the penguin pool. Each child got a tuna sandwich.", facts: [{ label: "Lunch time", value: "11 AM" }, { label: "Lunch spot", value: "penguin pool" }, { label: "Sandwich", value: "tuna" }] },
      { index: 3, text: "After lunch, Sam fed two giraffes some lettuce from a paper bag.", facts: [{ label: "Feeder", value: "Sam" }, { label: "Giraffes", value: "2" }, { label: "Food", value: "lettuce" }] },
      { index: 4, text: "The bus left the zoo at 3 PM and got back to school just before 4 PM.", facts: [{ label: "Depart time", value: "3 PM" }, { label: "Return time", value: "before 4 PM" }] },
      { index: 5, text: "Mrs. Akin gave every student a small green sticker shaped like a turtle.", facts: [{ label: "Reward color", value: "green" }, { label: "Reward shape", value: "turtle" }] },
    ],
  },
  {
    id: "l2-train",
    difficulty: 2,
    title: "The 9:14 to Brighton",
    segments: [
      { index: 0, text: "Daniel boarded the 9:14 train at Victoria Station carrying a brown leather briefcase and a coffee cup.", facts: [{ label: "Passenger", value: "Daniel" }, { label: "Train time", value: "9:14" }, { label: "Station", value: "Victoria" }, { label: "Briefcase", value: "brown leather" }, { label: "Cup", value: "red coffee cup", is_distractor: true }] },
      { index: 1, text: "In car number four he sat opposite a woman reading a French newspaper called Le Monde.", facts: [{ label: "Car number", value: "4" }, { label: "Reader", value: "woman opposite" }, { label: "Newspaper", value: "Le Monde" }] },
      { index: 2, text: "At Croydon a teenager in a yellow hoodie sat next to him and put earbuds in.", facts: [{ label: "Stop", value: "Croydon" }, { label: "Teen jacket", value: "yellow hoodie" }, { label: "Color of earbuds", value: "white", is_distractor: true }] },
      { index: 3, text: "Daniel opened his briefcase and pulled out a notebook with three contracts to review.", facts: [{ label: "Item from case", value: "notebook" }, { label: "Contracts", value: "3" }] },
      { index: 4, text: "When the train arrived at Brighton at 10:42, it was raining and platform two was crowded.", facts: [{ label: "Arrival time", value: "10:42" }, { label: "Weather", value: "raining" }, { label: "Platform", value: "2" }] },
      { index: 5, text: "He took a black taxi to a meeting at the Grand Hotel that started at 11:30.", facts: [{ label: "Taxi color", value: "black" }, { label: "Destination", value: "Grand Hotel" }, { label: "Meeting time", value: "11:30" }] },
    ],
  },
  {
    id: "l2-vet",
    difficulty: 2,
    title: "An Afternoon at the Veterinary Clinic",
    segments: [
      { index: 0, text: "Dr. Patel arrived at the clinic at 1 PM wearing a green scrub top and white sneakers.", facts: [{ label: "Doctor", value: "Dr. Patel" }, { label: "Time", value: "1 PM" }, { label: "Scrub color", value: "green" }, { label: "Shoes", value: "white sneakers" }] },
      { index: 1, text: "Her first patient was a beagle named Biscuit who had hurt his right paw.", facts: [{ label: "Patient", value: "beagle Biscuit" }, { label: "Injury", value: "right paw" }, { label: "Injury", value: "left paw", is_distractor: true }] },
      { index: 2, text: "She prescribed five days of antibiotics and a small plastic cone for his neck.", facts: [{ label: "Treatment", value: "5 days antibiotics" }, { label: "Accessory", value: "plastic cone" }] },
      { index: 3, text: "At 2:30 PM, a tabby cat named Olive came in for vaccinations.", facts: [{ label: "Time", value: "2:30 PM" }, { label: "Patient", value: "tabby cat Olive" }, { label: "Reason", value: "vaccinations" }] },
      { index: 4, text: "The clinic took a 15-minute coffee break and the receptionist made oat milk lattes.", facts: [{ label: "Break length", value: "15 minutes" }, { label: "Drink", value: "oat milk lattes" }] },
      { index: 5, text: "By closing at 6 PM, Dr. Patel had seen eleven animals and eaten zero proper meals.", facts: [{ label: "Close time", value: "6 PM" }, { label: "Animals seen", value: "11" }, { label: "Meals", value: "0" }] },
    ],
  },
  {
    id: "l3-heist",
    difficulty: 3,
    title: "The Museum Mix-Up",
    segments: [
      { index: 0, text: "On Friday March 14th, the Highbury Museum opened a new exhibit of seven Roman coins on loan from Italy.", facts: [{ label: "Date", value: "March 14th" }, { label: "Museum", value: "Highbury" }, { label: "Coins", value: "7 Roman" }, { label: "Country", value: "Italy" }] },
      { index: 1, text: "Curator Anita arrived at 7:45 AM and noticed the alarm on case three was blinking amber.", facts: [{ label: "Curator", value: "Anita" }, { label: "Time", value: "7:45 AM" }, { label: "Case", value: "3" }, { label: "Alarm color", value: "amber" }, { label: "Alarm color", value: "red", is_distractor: true }] },
      { index: 2, text: "She called security guard Joe, who reviewed the camera footage from 11 PM the previous night.", facts: [{ label: "Guard", value: "Joe" }, { label: "Footage time", value: "11 PM" }, { label: "Footage", value: "from previous night" }] },
      { index: 3, text: "The footage showed a cleaner in a navy uniform unlocking case three for nine seconds.", facts: [{ label: "Uniform color", value: "navy" }, { label: "Action", value: "unlocked case 3" }, { label: "Duration", value: "9 seconds" }, { label: "Duration", value: "19 seconds", is_distractor: true }] },
      { index: 4, text: "Two coins were missing: a denarius from the year 54 AD and a sestertius from 117 AD.", facts: [{ label: "Missing coins", value: "2" }, { label: "Coin 1", value: "denarius 54 AD" }, { label: "Coin 2", value: "sestertius 117 AD" }] },
      { index: 5, text: "By Monday morning the police had recovered both coins from a pawn shop on Carter Lane for £4,200.", facts: [{ label: "Recovery day", value: "Monday" }, { label: "Location", value: "Carter Lane pawn shop" }, { label: "Amount", value: "£4,200" }] },
    ],
  },
  {
    id: "l3-rocket",
    difficulty: 3,
    title: "Launch Window",
    segments: [
      { index: 0, text: "On October 9th, engineers at Pad 39B prepared the Helix-7 rocket for a 2:18 AM launch.", facts: [{ label: "Date", value: "October 9th" }, { label: "Pad", value: "39B" }, { label: "Rocket", value: "Helix-7" }, { label: "Time", value: "2:18 AM" }] },
      { index: 1, text: "Lead engineer Priya wore headset channel four and reported wind speeds of 12 knots from the south.", facts: [{ label: "Lead", value: "Priya" }, { label: "Channel", value: "4" }, { label: "Wind", value: "12 knots south" }, { label: "Wind", value: "21 knots south", is_distractor: true }] },
      { index: 2, text: "T-minus 90 seconds, the cryogenic fuel valve on stage two showed a pressure drop of 3 PSI.", facts: [{ label: "Mark", value: "T-90 seconds" }, { label: "System", value: "cryogenic fuel valve stage 2" }, { label: "Drop", value: "3 PSI" }] },
      { index: 3, text: "Priya called a hold and the team had eleven minutes before the launch window closed.", facts: [{ label: "Hold", value: "called by Priya" }, { label: "Window remaining", value: "11 minutes" }] },
      { index: 4, text: "Technician Marco rerouted helium pressure through backup line B and restored nominal readings.", facts: [{ label: "Tech", value: "Marco" }, { label: "Fix", value: "rerouted helium" }, { label: "Line", value: "backup B" }] },
      { index: 5, text: "Helix-7 lifted off at 2:26 AM, eight minutes late, with three satellites bound for low Earth orbit.", facts: [{ label: "Launch", value: "2:26 AM" }, { label: "Late", value: "8 minutes" }, { label: "Satellites", value: "3 to LEO" }] },
    ],
  },
];

export const RECALL_INSTRUCTIONS = [
  { id: "chronological", label: "In chronological order", text: "Reconstruct the story in chronological order from beginning to end." },
  { id: "reverse", label: "In reverse order", text: "Reconstruct the story in reverse order, from the last event to the first." },
  { id: "names_only", label: "Names and people only", text: "List every person mentioned in the story, in the order they appeared." },
  { id: "numbers_only", label: "Numbers and quantities only", text: "List every number, time, or quantity mentioned, in order." },
  { id: "perspective", label: "From one character's perspective", text: "Retell the story from the perspective of the main character." },
  { id: "facts_only", label: "Just the facts", text: "State only the verifiable facts from the story, no narrative connective text." },
];

export type RecallInstruction = (typeof RECALL_INSTRUCTIONS)[number];

export function pickStory(difficulty: 1 | 2 | 3 | 4, used: string[]) {
  const pool = STORY_LIBRARY.filter((s) => s.difficulty === difficulty && !used.includes(s.id));
  if (pool.length === 0) {
    // Fall back to any story at this level
    const fallback = STORY_LIBRARY.filter((s) => s.difficulty === difficulty);
    return fallback[Math.floor(Math.random() * fallback.length)] ?? STORY_LIBRARY[0];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

export function pickInstruction(used: string[]) {
  const pool = RECALL_INSTRUCTIONS.filter((r) => !used.includes(r.id));
  if (pool.length === 0) return RECALL_INSTRUCTIONS[Math.floor(Math.random() * RECALL_INSTRUCTIONS.length)];
  return pool[Math.floor(Math.random() * pool.length)];
}