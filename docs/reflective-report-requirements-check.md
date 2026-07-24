# Reflective Report Requirements Check

Internal checklist confirming where `docs/reflective-report.md` (canonical) and
`Reflective_Report_IncidentIQ.docx` (synchronized copy) address each official requirement. Not part
of the submitted report itself.

| Official Requirement | Final Section | Status |
| --- | --- | --- |
| Project overview and purpose | 1. Project Overview and Purpose | Covered |
| System architecture and main features | 4. System Architecture; 5. Main Features | Covered |
| Technologies used | 6. Technology Stack | Covered |
| How AI was used | 8. How AI Is Used | Covered |
| Important prompts | 9. Important Prompts and Prompt Versions (full detail in `docs/prompts.md`) | Covered |
| Prompt iterations | 10. Prompt Iterations -- now includes a completed real `v1`-vs-`v2` comparison and prompt-sensitivity test, with an honest "does not show `v2` outperforming `v1`" conclusion | Covered |
| Examples of useful AI outputs | 17. Useful AI Outputs -- concrete examples from the real OpenAI verification (Assumption/Fact separation, valid evidence ids, concrete actions, Skeptic Review findings) | Covered |
| Examples of incorrect/incomplete/misleading/hallucinated/unsupported/overconfident AI outputs | 18. Incorrect, Incomplete, Misleading, or Overconfident AI Outputs -- real empty-`reasoningRisks`/empty-`contradictingEvidenceIds` findings, updated with the new `v1`/`v2`/sensitivity comparison | Covered |
| Problems encountered and solutions | 20. Problems Encountered and Solutions | Covered |
| At least three cognitive biases or logical fallacies | 16. Biases and Logical Fallacies -- table covering 5 (confirmation bias, post-hoc fallacy, anchoring bias, base-rate neglect, automation bias), each with where/effect/how-noticed/how-reduced | Covered (5 of 8 schema types, exceeds the minimum of 3) |
| Ethical and professional risks | 22. Ethical and Professional Risks (full detail in `docs/ethical-and-professional-risks.md`) | Covered |
| Division of work | 27. Division of Work | Covered |
| Future improvements | 26. Future Improvements | Covered |
| Lessons learned | Lessons Learned subsection (under Section 20) | Covered |
| GitHub repository link | 29. GitHub Repository Link (also in the opening metadata block) | Covered |
| Demo-video placeholder | 30. Demo Video Link (also in the opening metadata block) -- `[TO BE ADDED AFTER RECORDING]`, never claimed to exist | Covered |
| 5-10 rendered page requirement | Whole document | **Verified: 10 pages**, confirmed independently via Microsoft Word COM automation (`ComputeStatistics`) and PyMuPDF page rendering on the final DOCX/PDF -- within range |

## Supporting verification performed (not requirements themselves, but evidence behind the table above)

- **Real prompt-comparison and prompt-sensitivity experiments were actually run** (not left `NOT RUN`): 4 new real OpenAI calls, `sample-db-connection-leak`, `gpt-4o-mini`, saved in `docs/experiments/reflective-report-completion/`.
- **Test count verified by execution**, not carried forward: 890/890 (709 backend, 181 frontend) via `npm run test` while finalizing this report.
- **React Testing Library / component-test claim verified by inspection**: no RTL/jsdom/happy-dom dependency exists in either `package.json` — the "no component-level frontend test suite" limitation remains accurate, not stale.
- **Student/institution details verified consistent** across the Markdown, the DOCX, and this checklist: Nechami Rabinovitz and Maayan Vaknin (spelling double-checked — no "Mayan" typo found anywhere in the repository), Jerusalem Multidisciplinary College, Computer Science, Pair project, `https://github.com/nechamirab/incident-iq`, demo video placeholder.
- **Markdown and DOCX synchronized**: the DOCX was regenerated directly from the final Markdown (same 30-section structure, same content, same conclusions and limitations) after every edit described above.
