"""Offline regression tests for the no-cost PR guard."""
import unittest

from check_pr_scope import evaluate, reasons_for


class FrozenScopeTests(unittest.TestCase):
    def test_locked_story_content(self):
        for path in (
            "data/s001-story.js", "stories/S004/story.json",
            "images/001/opening.png", "images/004/camp.png",
            "js/story-s003.js", "js/st004-bazaar.js",
        ):
            with self.subTest(path=path):
                self.assertTrue(reasons_for(path))

    def test_locked_audio(self):
        for path in (
            "js/AudioManager.js", "assets/audio/bgm.mp3",
            "js/voice-player.js", "sound/effects.js", "js/sfx.js", "tts/speech.js",
        ):
            with self.subTest(path=path):
                self.assertIn("Audio/Voice freeze until S015", reasons_for(path))

    def test_story_additions_remain_allowed(self):
        for path in (
            "stories/S008/story.json", "images/008/Scene-01.png",
            "data/s015-communication.js", "prototype/common-engine-v2-audiofree/judge.cjs",
            "prototype/common-engine-v2-audiofree/play.css",
        ):
            with self.subTest(path=path):
                self.assertEqual([], reasons_for(path))

    def test_protect_self_and_director_approved_rules(self):
        for path in (
            "scripts/qa_guard/check_pr_scope.py",
            ".github/workflows/qa-guard-free.yml",
            "docs/approved/story-specs/S008.json",
        ):
            with self.subTest(path=path):
                self.assertTrue(reasons_for(path))
                self.assertFalse(reasons_for(path, bootstrap=True))

    def test_freeze_does_not_confuse_audiofree_prototype(self):
        for path in (
            "prototype/common-engine-v2-audiofree/play.js",
            "prototype/common-engine-v2-audio-free/play.css",
        ):
            with self.subTest(path=path):
                self.assertFalse(reasons_for(path), path)
        self.assertTrue(reasons_for("js/AudioManager.js"))
        self.assertTrue(reasons_for("data/sound-effects.js"))
        self.assertTrue(reasons_for("assets/intro.mp3"))
        self.assertTrue(reasons_for("resources/signal.wav"))

    def test_fail_closed_multiple_paths(self):
        result = evaluate(["images/003/scene.png", "stories/S008/story.json", "js/AudioManager.js"])
        self.assertEqual(2, len(result))


if __name__ == "__main__":
    unittest.main()
