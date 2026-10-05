from app.stats.service import summarize_results


def test_summarize_results_counts_outcomes_and_goals():
    summary = summarize_results([(3, 1), (2, 2), (0, 1)])

    assert summary == {
        "played": 3,
        "wins": 1,
        "draws": 1,
        "losses": 1,
        "goals_for": 5,
        "goals_against": 4,
        "form": ["W", "D", "L"],
    }


def test_summarize_results_empty_season():
    assert summarize_results([])["played"] == 0
