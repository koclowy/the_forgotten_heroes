DROP YOUR SOUNDS HERE. Keep these names (lower case: the live site is case-sensitive).
.mp3 .ogg .wav or .m4a all work. Paths and volumes are in content/assets.json -> sounds.

MUSIC (music/, each one loops; crossfades ~0.7 s when the screen changes, and a track you
come back to carries on where it was)
music/normal_bg     title, Nova's intro, planet selection, bonus announcement, Pioneer 10's
                    story (open space), ending, credits
music/moon_bg       the Moon surface + every Moon equipment screen, until its quiz starts
music/mars_bg       the Mars surface + every Mars equipment screen, until its quiz starts
music/quiz_bg       every quiz (Pioneer 10's too), while the quiz panel is up

EFFECTS
buttons/button_click   every button (incl. back, "i", mute, credits) + clicking to continue a dialog
buttons/hover          hovering a planet or equipment
transitions/transition_between_planets_equipment
                       intro -> planets, zooming into a planet / equipment, zooming back out
transitions/fade       title -> Nova's intro, -> ending, -> credits
game/typewriter        each letter of the title
game/successfully_completed_quiz   a right answer
game/failed_quiz                   a wrong answer
game/points_collection             "Collect Research Points"
game/bonus                         the bonus equipment appears

VOICES (vocal/)
vocal/scientist/       Nova: any number of SHORT blips (~0.05-0.15 s). One is picked at random every
                       2nd letter (voiceEveryNLetters), with a slight pitch change.
vocal/equipment/       one "babble" clip per voice (a few seconds long). Each word of the
                       equipment's text plays a word-length slice of it from a random spot.
  equipment_low_pitch      Apollo Lunar Modules, Viking 1 Lander
  equipment_high_pitch     Lunar Roving Vehicles, Spirit & Opportunity
  equipment_medium_pitch   ALSEP Scientific Packages
  equipment_normal         InSight Lander, Pioneer 10, and any equipment without its own voice
  Which file each equipment uses = "voice" in content/equipment/<id>.json.
vocal/narrator/        (empty = the description panel types silently)

Before the first click / tap / key press the site is silent (browsers block audio until then).
