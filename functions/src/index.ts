import * as functions from "firebase-functions";
import * as Octokit from "@octokit/rest";
import { IncomingWebhook } from "@slack/client";

export const notify = functions.https.onRequest(async (request, response) => {
  if ("repo" in request.query) {
    const webhook = new IncomingWebhook(functions.config().slack.url);

    const octokit = new Octokit();
    const result = await octokit.search.issuesAndPullRequests({
      q: `repo:${request.query.repo} is:pr state:closed`,
      sort: "updated",
      order: "desc"
    });
    const now = new Date();
    const today_prs = [];
    for (const pr of result.data.items) {
      const updated_at = new Date(pr.updated_at);
      const diff_msec = now.getTime() - updated_at.getTime();
      if (diff_msec < 24 * 60 * 60 * 1000) {
        today_prs.push(pr);
      } else {
        break;
      }
    }
    const message = today_prs
      .map(pr => {
        return `* <${pr.html_url}|${pr.title}> by ${pr.user.login}`;
      })
      .join("\n");

    webhook.send(
      "Today closed pull-requests on " +
        `<https://github.com/${request.query.repo}|${
          request.query.repo
        }> are:\n` +
        message,
      (err, res) => {
        if (err) {
          response
            .status(500)
            .send(`Failed to send text to slack: ${err.toString()}`);
        } else {
          response.send("Done");
        }
      }
    );
  } else {
    response.status(500).send("No repo query is specified");
  }
});
