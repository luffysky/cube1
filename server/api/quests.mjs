// Daily quests award coins only from server-settled ranked matches.
// Local CPU/practice, advertisements, client scores or arbitrary claims do not count.
export const DAILY_QUESTS=Object.freeze([
 Object.freeze({id:'ranked_play_1',target:1,coins:10,kind:'completed'}),
 Object.freeze({id:'ranked_play_3',target:3,coins:20,kind:'completed'}),
 Object.freeze({id:'ranked_win_1',target:1,coins:20,kind:'wins'})
]);
export const QUEST_LIMIT_COINS=DAILY_QUESTS.reduce((sum,q)=>sum+q.coins,0);
export const getDailyQuest=id=>DAILY_QUESTS.find(q=>q.id===id);
