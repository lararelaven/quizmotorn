import { ADJECTIVES, NOUNS, FUN_TEAM_NAMES } from './constants';

export const generateRandomName = () => {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    return `${adj} ${noun}`;
};

export const generateTeamNames = (count) => {
    const shuffled = [...FUN_TEAM_NAMES].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
};

export const generatePin = () => Math.floor(100000 + Math.random() * 900000).toString();