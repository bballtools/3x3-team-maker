# 3x3-team-maker
Team maker for 3x3 Unites

The workspace has four tabs: **Players**, **Setup**, **Teams & games**, and
**Schedule**. At 18:00, select the players actually present, create and review
teams, then approve. Checking in late arrivals keeps approved courts intact and
adds those players to unassigned rotation. Assign them as substitutes or include
them in the next remix. To remove players already on an approved roster, record
the game first and use **Change attendance for next teams**, then update
attendance and create the next formation. Earlier completions remain saved.

In **Players**, collapse **Select players** to hide the roster and focus on the
live **Checked-in players** overview below it. It shows totals and proportions
for each age group, then lists names by age group and skill from 1 to 10, with
unrated guests separate. The overview always includes the full attendance
selection, including players outside the current search or age filter. Rating
edits, check-ins, removals and session resets update it immediately.

Skills use whole numbers from **1 to 10**, shared across all ages, displayed in
one numbered basketball. The HHW central roster uses Marc's supplied ratings.
Legacy 1–5 saved ratings are migrated once; leaders can adjust any permanent
player's rating in Players. These edits persist on this device. They do not move
approved teams; the next generation uses the updated ratings.

Official roster rating revisions replace older device overrides for those
players, including ratings displayed on saved teams, without moving anyone or
changing completed-game counts. Later leader edits remain editable and persist
until the next official revision. Local newcomers' rating edits are unaffected.

**Schedule** automatically lists approved matchups and completed games with their
winners. Championship games appear after the leader reviews the preview and
chooses **Start these games**. Manual team moves update the upcoming games while
completed matchups retain their original rosters and winners. Notes remain
independently editable. Notes, attendance, results and approved layouts survive
same-day reloads and clear with a new session or date. Older sessions without
winner records retain their counts; winners are not inferred retrospectively.

After approval, choose a **Winner** on each court, then confirm **Game completed
— all courts**. This records the results and counts once, then opens the next-game
choice. **Reset & remix teams** builds a new draft for review and approval.
**Keep championship** previews whole-team matchups in four selectable modes:

- **All waiting teams first — then winners, then losers** is the first option
  and the default when teams are waiting. Fill available places from the waiting
  queue first, then with winners, then losers. Winners may rest if waiting teams
  fill all places. Teams still waiting retain priority over newly benched teams
  in the next game. Court capacity and category restrictions can make further
  waiting unavoidable. Waiting teams face winners when possible; remaining
  games pair matching outcomes where possible.

- **Winners vs winners · losers vs losers** pairs matching outcomes. Waiting
  teams stay on the bench in this mode.
- **Waiting teams first — play against winners** keeps the previous behavior.
  Winners keep their court places; waiting
  teams enter in queue order to face them. Remaining places go to losers, with
  winners vs winners and losers vs losers wherever possible. If the waiting
  queue is larger than the available places, excess teams keep waiting.
- **Waiting teams first — play against losers** uses the existing waiting queue, then losing teams,
  then winners to fill the available places. Waiting teams face losers first;
  winners rest as far as capacity allows. Excess waiting teams remain queued.

Kids-only groups, selected category matchups and 3v3/4v4 formats remain separate. Odd
group sizes can require a mixed pairing; the preview explains this fallback.
Review both the courts and waiting list before **Start these games**. Unassigned
players remain in rotation until assigned as substitutes or included in a remix.
The category matchup also applies in championship play; outcome-based pairings
yield to the chosen opposing categories when both cannot be satisfied.
The next batch requires new winner choices. **Undo last completion** allows
correcting results and counters; it leaves any subsequently arranged courts in
place. There is no automatic two-consecutive-wins rule.

**Auto — reduce waiting** compares 3v3 and 4v4 for each independent group. It
first reduces players waiting outside active team rosters, then unused baskets,
then waiting teams; ties favor more players simultaneously on court and finally
3v3. Leftovers are attached as substitutes to different teams, preferring teams
already on court, with at most one extra per team. If every compatible team
already has an extra player, remaining players stay in unassigned rotation.
Explicit 3v3/4v4 settings retain manual substitute assignment. A reserved Kids
basket stays 3v3.

Every mix checks approved rotation history, including both unassigned rotating
players and assigned substitutes. It avoids repeating the last formation's roles
when enough alternatives exist, then favors players with fewer past roles.
Roles are remembered even if the leader later returns a substitute to rotation.
Some repeats may be unavoidable in a small group. Legacy history contributes the
unassigned rotation IDs it recorded; new history also stores substitute roles.

Remixes prioritize players with fewer completed games, including newcomers with
zero games, for available court roster places (including Auto substitutes).
This priority applies within each compatible group before balancing skills.
When all counts are equal, all teams are balanced together, including waiting
teams. Otherwise, active and waiting pools are balanced separately. The builder
minimizes the gap in team skill totals, then their variance, then spreads age
categories and skill ratings, and finally reduces repeated teammates. It uses a
bounded search, so the best possible balance is not guaranteed for every roster.
In **Setup → Category groups**, choose **Build teams** for each group:

- **Mix selected categories into teams** combines the two categories into one
  balanced pool. For example, U18 + 18+ creates teams containing both ages where
  possible, rather than pure U18 teams opposing pure adult teams. The pool needs
  at least six players in total, with a 3v3 fallback if there are fewer than eight.
- **Separate category teams — play each other** retains category-versus-category
  games. Selecting 18+ and 18+ still creates adult-only games, and selecting
  U14 and U16 creates pure U14 teams against pure U16 teams.

Choose a maximum basket allocation per group. Use **Add another category group**
for additional groups. Existing saved groups without a mode retain separate-team
behavior. Mixed groups stay together during championship play, player swaps,
team moves and substitute assignments; both selected categories are eligible.
For example, six baskets can be allocated as one Kids basket, one U16 vs U16,
one 18+ vs 18+, and three baskets for mixing the other categories (when enough
players remain). Each category can appear in one rule. Duplicate categories or
allocations exceeding the available baskets must be corrected before generating;
Setup shows the basket budget. Extra rules can be removed individually and are
restored with the approved session. Matchup groups remain separate in championship
play and manual moves. U14 vs U16 builds pure U14 teams against pure U16 teams; U16 vs U16 or
18+ vs 18+ uses two teams from that category. Everyone else is mixed on remaining
baskets. Cross-category games need at least three available players in each
category; the same-category option needs six. The app falls back to 3v3 when a
selected category cannot supply four per side. If attendance is insufficient,
Setup and the generated result explain that mixing applies until the requirement
is met. The Kids basket and its selected U14 helpers take priority. Restricting
baskets or categories can make waiting unavoidable, even for newcomers; game-count
priority is enforced within the remaining compatible capacity. Settings survive
an approved-session reload; older 18+-only settings map to 18+ vs 18+.

Kids are mixed by default. **Reserve one basket for Kids only** separates a
selected Kids group onto one 3v3 basket. When fewer than six actual Kids attend,
creating teams first asks whether to keep a separate basket or mix the Kids.
Keeping the basket opens two teams with six places: fill empty places with
attending U14 helpers or **Add Dunker**. All six places must be filled before
continuing; the remaining teams are generated from the other participants.
Helpers stay in the selected Kids group and cannot also appear in regular teams.
Use **Edit Kids group** to change the selection and regenerate the formation.

Dunker 1, Dunker 2, etc. represent actual guests who will play. They are temporary
for the evening and never saved as permanent newcomers. Unknown skills are shown
as unknown and excluded from displayed averages; a team with no known ratings
shows “Avg —”. Set a Dunker's skill from 1 to 10 on its team card when known.
For allocation only, unknown skills are treated neutrally using the group's
known average (or 6 if none is known). Shared game completions count assigned
Dunkers like other players. Guests, helper selection and ratings survive a
same-day reload; starting a new session clears them. Cancelling setup adds no
guests and leaves the existing formation intact.

Extra Kids-group members wait or rotate within that group. This applies in every
game format; the optional category matchup uses the remaining baskets. With only
one basket, the Kids group plays and other teams wait. Manual swaps, team moves
and substitute assignments respect the selected group, including U14 helpers.

**Search players** filters names within the selected age tab, ignoring case and
accents. Clearing search restores the list. Search does not change attendance;
the select/clear control applies only to visible players.

After approving a formation and selecting the winners, use **Game completed — all courts** in Round
controls once when the shared game finishes. It adds one game to every team
currently on court and all its roster members, including substitutes. Waiting
teams and unassigned players receive no games. **Undo last completion** reverses
the last shared completion for the exact matchups that were on court then, even
after team moves, substitute changes, a remix or a reload. The history is read-only;
previous per-court counts are preserved and are not grouped retrospectively.
Player counts follow participants across remixes; a lineup count belongs to the
same set of players, regardless of its team letter. Lower player counts are
highlighted among currently present participants. Recorded counts prioritize
less-played players during remixes; championship continuation follows the
leader's selected pairing policy while keeping whole teams together.

Team moves are always available; there is no championship-mode checkbox.
Keep teams together while changing opponents: record the game first, then choose **Move team** on a waiting
team and on the team it replaces. Two teams already on courts can also exchange
positions. Only the same game format and compatible Kids/category groups can be
exchanged. Championship previews propose the next matchups; leaders can also
choose them manually. **Reset & remix** creates
a new formation instead of calling the next team. The approved court layout,
substitute assignments resume after a same-day reload. Older saved sessions
automatically gain team moves, even if championship mode used to be off.

Use **Assign as substitute** under an unassigned rotating player to add that
player to a compatible team without removing anyone. A team can have one extra
player; the number on court remains 3 or 4. **Return … to rotation** makes the
player unassigned again. There are no individual participation checkboxes:
new completions count every roster member, including substitutes. Changed
assignments start a new matchup counter; previous games retain their original
rosters and any historical participant exclusions. Team totals span changes within
the formation; exact-lineup and player counters remain distinct.

Counts are saved in the existing local evening session and reset with
**Clear today's session** or on a new date. Older approved rounds start at zero because
completion was not previously recorded. Session data remains specific to this browser/device.

Run the automated checks with `node --test tests/*.test.cjs`.

The temporary developer report button has been removed from the leaders' testing version.

**Setup → Session reset → Clear today's session** is the only manual action for
starting fresh: it clears attendance, games, winners, formations and notes on
this device after an explicit warning. Permanent players and saved ratings stay.
For mid-activation setup changes, adjust Setup and use **Create balanced teams**
in Players, or **Reset & remix**. Those actions keep today's attendance, recorded
game counts and notes. Do not clear the session merely to change category groups.
