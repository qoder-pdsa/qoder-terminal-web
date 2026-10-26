import {
  HELP_COMMAND_BAR_LINES,
  HELP_EXAMPLES,
  HELP_FUNCTION_ROWS,
  HELP_SYMBOL_LINES,
} from "./helpContent";
import type { PanelContext } from "./registry";

/** The quick help panel: an English cheat sheet plus examples that run like typed commands. */
export function HelpPanel({ run }: PanelContext) {
  return (
    <div data-testid="help-panel">
      <h3 className="help-section">FUNCTIONS</h3>
      <table className="help-functions">
        <tbody>
          {HELP_FUNCTION_ROWS.map((row) => (
            <tr key={row.code}>
              <td className="help-code">{row.syntax}</td>
              <td className="muted">{row.blurb}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3 className="help-section">SYMBOLS</h3>
      <p className="muted help-lines">{HELP_SYMBOL_LINES.join(" · ")}</p>
      <h3 className="help-section">COMMAND BAR</h3>
      {HELP_COMMAND_BAR_LINES.map((line) => (
        <p className="muted help-lines" key={line}>
          {line}
        </p>
      ))}
      <h3 className="help-section">TRY AN EXAMPLE</h3>
      <div className="help-examples">
        {HELP_EXAMPLES.map((example) => (
          <button type="button" data-testid="help-example" key={example} onClick={() => run(example)}>
            {example}
          </button>
        ))}
      </div>
      <p className="muted help-lines">Click any example to run it — this panel stays open.</p>
    </div>
  );
}
