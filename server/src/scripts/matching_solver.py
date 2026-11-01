#!/usr/bin/env python3
"""
OR-Tools Constraint Solver for Hybrid Resource Planning.

This script solves the optimal agent-venue-manager assignment problem using
Google OR-Tools CP-SAT solver. It is called by the Node.js matching-solver service
via subprocess with JSON input/output.

Usage:
  python matching_solver.py < input.json
  # outputs result.json to stdout
"""

import sys
import json
from ortools.sat.python import cp_model


def solve_optimal_match(input_data: dict) -> dict:
    """
    Solve the optimal agent-venue-manager assignment problem.

    Inputs:
      - job: { id, title, requiredSkills[], budgetUsd, location, durationHours }
      - availableAgents: [{ id, name, location, skills[], availabilityBlocks[], trustScore }]
      - venues: [{ id, name, location, capacity, openHours[], costPerHour }]
      - managers: [{ id, name, shifts[], skills[] }]

    Hard Constraints:
      - Agent must be free during job duration
      - Venue must be open during job duration
      - Manager must be on shift during job duration
      - Agent must have required skill

    Soft Constraints:
      - Minimize travel distance
      - Maximize Trust Score
      - Stay under budget
    """
    job = input_data.get("job", {})
    agents = input_data.get("availableAgents", [])
    venues = input_data.get("venues", [])
    managers = input_data.get("managers", [])

    if not agents or not venues or not managers:
        return {
            "success": False,
            "error": "Missing agents, venues, or managers",
            "assignment": None,
        }

    model = cp_model.CpModel()

    # Decision variables: x[a][v][m] = 1 if agent a is assigned to venue v with manager m
    x = {}
    for a_idx, agent in enumerate(agents):
        for v_idx, venue in enumerate(venues):
            for m_idx, manager in enumerate(managers):
                x[a_idx, v_idx, m_idx] = model.NewBoolVar(f"x_{a_idx}_{v_idx}_{m_idx}")

    # Each agent can be assigned at most once
    for a_idx in range(len(agents)):
        model.Add(sum(x[a_idx, v_idx, m_idx] for v_idx in range(len(venues)) for m_idx in range(len(managers))) <= 1)

    # Each venue can be used at most once for this job
    for v_idx in range(len(venues)):
        model.Add(sum(x[a_idx, v_idx, m_idx] for a_idx in range(len(agents)) for m_idx in range(len(managers))) <= 1)

    # Each manager can be assigned at most once
    for m_idx in range(len(managers)):
        model.Add(sum(x[a_idx, v_idx, m_idx] for a_idx in range(len(agents)) for v_idx in range(len(venues))) <= 1)

    # === HARD CONSTRAINTS ===

    # Agent must have required skills
    required_skills = set(job.get("requiredSkills", []))
    for a_idx, agent in enumerate(agents):
        agent_skills = set(agent.get("skills", []))
        if not required_skills.issubset(agent_skills):
            for v_idx in range(len(venues)):
                for m_idx in range(len(managers)):
                    model.Add(x[a_idx, v_idx, m_idx] == 0)

    # Agent must be available during job duration
    job_start = job.get("startTime", 0)  # epoch minutes or hour-of-day
    job_end = job_start + job.get("durationHours", 1)

    for a_idx, agent in enumerate(agents):
        available = False
        for block in agent.get("availabilityBlocks", []):
            if block.get("start", 0) <= job_start and block.get("end", 24) >= job_end:
                available = True
                break
        if not available:
            for v_idx in range(len(venues)):
                for m_idx in range(len(managers)):
                    model.Add(x[a_idx, v_idx, m_idx] == 0)

    # Venue must be open during job duration
    for v_idx, venue in enumerate(venues):
        venue_open = False
        for hours in venue.get("openHours", []):
            if hours.get("start", 0) <= job_start and hours.get("end", 24) >= job_end:
                venue_open = True
                break
        if not venue_open:
            for a_idx in range(len(agents)):
                for m_idx in range(len(managers)):
                    model.Add(x[a_idx, v_idx, m_idx] == 0)

    # Manager must be on shift during job duration
    for m_idx, manager in enumerate(managers):
        manager_on_shift = False
        for shift in manager.get("shifts", []):
            if shift.get("start", 0) <= job_start and shift.get("end", 24) >= job_end:
                manager_on_shift = True
                break
        if not manager_on_shift:
            for a_idx in range(len(agents)):
                for v_idx in range(len(venues)):
                    model.Add(x[a_idx, v_idx, m_idx] == 0)

    # === SOFT CONSTRAINTS (Objective) ===

    # Maximize trust score
    trust_terms = []
    for a_idx, agent in enumerate(agents):
        trust = agent.get("trustScore", 500)
        for v_idx in range(len(venues)):
            for m_idx in range(len(managers)):
                trust_terms.append(trust * x[a_idx, v_idx, m_idx])

    # Minimize travel distance (agent to venue)
    travel_terms = []
    for a_idx, agent in enumerate(agents):
        agent_loc = agent.get("location", "")
        for v_idx, venue in enumerate(venues):
            venue_loc = venue.get("location", "")
            # Simple distance proxy: same location = 0, different = 1
            distance = 0 if agent_loc == venue_loc else 1
            for m_idx in range(len(managers)):
                travel_terms.append(distance * x[a_idx, v_idx, m_idx])

    # Stay under budget
    budget = job.get("budgetUsd", float("inf"))
    venue_cost_terms = []
    for v_idx, venue in enumerate(venues):
        cost = venue.get("costPerHour", 0) * job.get("durationHours", 1)
        for a_idx in range(len(agents)):
            for m_idx in range(len(managers)):
                venue_cost_terms.append(cost * x[a_idx, v_idx, m_idx])

    # Objective: maximize trust, minimize travel, stay under budget
    model.Maximize(
        sum(trust_terms) * 1000  # weight trust heavily
        - sum(travel_terms) * 100
        - sum(venue_cost_terms) * 10
    )

    # Budget constraint (hard)
    for v_idx, venue in enumerate(venues):
        cost = venue.get("costPerHour", 0) * job.get("durationHours", 1)
        if cost > budget:
            for a_idx in range(len(agents)):
                for m_idx in range(len(managers)):
                    model.Add(x[a_idx, v_idx, m_idx] == 0)

    # Solve
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 30
    status = solver.Solve(model)

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        # Find the selected assignment
        selected = None
        for a_idx, agent in enumerate(agents):
            for v_idx, venue in enumerate(venues):
                for m_idx, manager in enumerate(managers):
                    if solver.Value(x[a_idx, v_idx, m_idx]):
                        selected = {
                            "agent": agent,
                            "venue": venue,
                            "manager": manager,
                            "agentIndex": a_idx,
                            "venueIndex": v_idx,
                            "managerIndex": m_idx,
                        }
                        break

        return {
            "success": True,
            "solverStatus": "OPTIMAL" if status == cp_model.OPTIMAL else "FEASIBLE",
            "objectiveValue": float(solver.ObjectiveValue()),
            "assignment": selected,
        }
    else:
        return {
            "success": False,
            "error": f"No feasible solution found (status: {status})",
            "assignment": None,
        }


if __name__ == "__main__":
    try:
        input_data = json.load(sys.stdin)
        result = solve_optimal_match(input_data)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e), "assignment": None}))
        sys.exit(1)
