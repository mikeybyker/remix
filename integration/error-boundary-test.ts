import { test, expect } from "@playwright/test";

import { createAppFixture, createFixture, js } from "./helpers/create-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";
import { PlaywrightFixture, selectHtml } from "./helpers/playwright-fixture";

test.describe("ErrorBoundary", () => {
  let fixture: Fixture;
  let appFixture: AppFixture;
  let _consoleError: any;

  let ROOT_BOUNDARY_TEXT = "ROOT_BOUNDARY_TEXT";
  let OWN_BOUNDARY_TEXT = "OWN_BOUNDARY_TEXT";

  let HAS_BOUNDARY_LOADER = "/yes/loader";
  let HAS_BOUNDARY_ACTION = "/yes/action";
  let HAS_BOUNDARY_RENDER = "/yes/render";

  let NO_BOUNDARY_ACTION = "/no/action";
  let NO_BOUNDARY_LOADER = "/no/loader";
  let NO_BOUNDARY_RENDER = "/no/render";

  let NOT_FOUND_HREF = "/not/found";

  let META_ERROR = "/meta-error";
  let LINKS_ERROR = "/links-error";

  // packages/remix-react/errorBoundaries.tsx
  let INTERNAL_ERROR_BOUNDARY_HEADING = "Application Error";

  test.beforeAll(async () => {
    _consoleError = console.error;
    console.error = () => {};
    fixture = await createFixture({
      files: {
        "app/root.jsx": js`
          import { Links, Meta, Outlet, Scripts } from "@remix-run/react";

          export default function Root() {
            return (
              <html lang="en">
                <head>
                  <Meta />
                  <Links />
                </head>
                <body>
                  <main>
                    <Outlet />
                  </main>
                  <Scripts />
                </body>
              </html>
            );
          }

          export function ErrorBoundary() {
            return (
              <html>
                <head />
                <body>
                  <main>
                    <div>${ROOT_BOUNDARY_TEXT}</div>
                  </main>
                  <Scripts />
                </body>
              </html>
            )
          }
        `,

        "app/routes/index.jsx": js`
          import { Link, Form } from "@remix-run/react";
          export default function () {
            return (
              <div>
                <Link to="${NOT_FOUND_HREF}">${NOT_FOUND_HREF}</Link>

                <Form method="post">
                  <button formAction="${HAS_BOUNDARY_ACTION}" type="submit">
                    Own Boundary
                  </button>
                  <button formAction="${NO_BOUNDARY_ACTION}" type="submit">
                    No Boundary
                  </button>
                </Form>

                <p>
                  <Link to="${HAS_BOUNDARY_LOADER}">
                    ${HAS_BOUNDARY_LOADER}
                  </Link>
                </p>
                <p>
                  <Link to="${NO_BOUNDARY_LOADER}">
                    ${NO_BOUNDARY_LOADER}
                  </Link>
                </p>
                <p>
                  <Link to="${HAS_BOUNDARY_RENDER}">
                    ${HAS_BOUNDARY_RENDER}
                  </Link>
                </p>
                <p>
                  <Link to="${NO_BOUNDARY_RENDER}">
                    ${NO_BOUNDARY_RENDER}
                  </Link>
                </p>
                <p>
                  <Link to="${META_ERROR}">
                    ${META_ERROR}
                  </Link>
                </p>
                <p>
                  <Link to="${LINKS_ERROR}">
                    ${LINKS_ERROR}
                  </Link>
                </p>
              </div>
            )
          }
        `,

        [`app/routes${HAS_BOUNDARY_ACTION}.jsx`]: js`
          import { Form } from "@remix-run/react";
          export async function action() {
            throw new Error("Kaboom!")
          }
          export function ErrorBoundary() {
            return <p>${OWN_BOUNDARY_TEXT}</p>
          }
          export default function () {
            return (
              <Form method="post">
                <button type="submit" formAction="${HAS_BOUNDARY_ACTION}">
                  Go
                </button>
              </Form>
            );
          }
        `,

        [`app/routes${NO_BOUNDARY_ACTION}.jsx`]: js`
          import { Form } from "@remix-run/react";
          export function action() {
            throw new Error("Kaboom!")
          }
          export default function () {
            return (
              <Form method="post">
                <button type="submit" formAction="${NO_BOUNDARY_ACTION}">
                  Go
                </button>
              </Form>
            )
          }
        `,

        [`app/routes${HAS_BOUNDARY_LOADER}.jsx`]: js`
          export function loader() {
            throw new Error("Kaboom!")
          }
          export function ErrorBoundary() {
            return <div>${OWN_BOUNDARY_TEXT}</div>
          }
          export default function () {
            return <div/>
          }
        `,

        [`app/routes${NO_BOUNDARY_LOADER}.jsx`]: js`
          export function loader() {
            throw new Error("Kaboom!")
          }
          export default function () {
            return <div/>
          }
        `,

        [`app/routes${LINKS_ERROR}.jsx`]: js`
          export function links() {
            throw new Error("Kaboom!")
          }

          export default function () {
            return <div/>
          }
        `,

        [`app/routes${META_ERROR}.jsx`]: js`
          export function meta() {
            throw new Error("Kaboom!")
          }

          export default function () {
            return <div/>
          }
        `,

        [`app/routes${NO_BOUNDARY_RENDER}.jsx`]: js`
          export default function () {
            throw new Error("Kaboom!")
            return <div/>
          }
        `,

        [`app/routes${HAS_BOUNDARY_RENDER}.jsx`]: js`
          export default function () {
            throw new Error("Kaboom!")
            return <div/>
          }

          export function ErrorBoundary() {
            return <div>${OWN_BOUNDARY_TEXT}</div>
          }
        `,

        "app/routes/action.jsx": js`
          import { Outlet, useLoaderData } from "@remix-run/react";

          export function loader() {
            return "PARENT";
          }

          export default function () {
            return (
              <div>
                <p id="parent-data">{useLoaderData()}</p>
                <Outlet />
              </div>
            )
          }
        `,

        "app/routes/action/child-error.jsx": js`
          import { Form, useLoaderData } from "@remix-run/react";

          export function loader() {
            return "CHILD";
          }

          export function action() {
            throw new Error("Broken!");
          }

          export default function () {
            return (
              <>
                <p id="child-data">{useLoaderData()}</p>
                <Form method="post" reloadDocument={true}>
                  <button type="submit" name="key" value="value">
                    Submit
                  </button>
                </Form>
              </>
            )
          }

          export function ErrorBoundary({ error }) {
            return <p id="child-error">{error.message}</p>;
          }
        `,
      },
    });

    appFixture = await createAppFixture(fixture);
  });

  test.afterAll(async () => {
    console.error = _consoleError;
    await appFixture.close();
  });

  test("own boundary, action, document request", async () => {
    let params = new URLSearchParams();
    let res = await fixture.postDocument(HAS_BOUNDARY_ACTION, params);
    expect(res.status).toBe(500);
    expect(await res.text()).toMatch(OWN_BOUNDARY_TEXT);
  });

  // FIXME: this is broken, test renders the root boundary logging in `RemixRoute`
  // test's because the route module hasn't been loaded, my gut tells me that we
  // didn't load the route module but tried to render test's boundary, we need the
  // module for that!  this will probably fix the twin test over in
  // catch-boundary-test
  test.skip("own boundary, action, client transition from other route", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");
    await app.clickSubmitButton(HAS_BOUNDARY_ACTION);
    expect(await app.getHtml("main")).toMatch(OWN_BOUNDARY_TEXT);
  });

  test("own boundary, action, client transition from itself", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto(HAS_BOUNDARY_ACTION);
    await app.clickSubmitButton(HAS_BOUNDARY_ACTION);
    expect(await app.getHtml("main")).toMatch(OWN_BOUNDARY_TEXT);
  });

  test("bubbles to parent in action document requests", async () => {
    let params = new URLSearchParams();
    let res = await fixture.postDocument(NO_BOUNDARY_ACTION, params);
    expect(res.status).toBe(500);
    expect(await res.text()).toMatch(ROOT_BOUNDARY_TEXT);
  });

  test("bubbles to parent in action script transitions from other routes", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");
    await app.clickSubmitButton(NO_BOUNDARY_ACTION);
    expect(await app.getHtml("main")).toMatch(ROOT_BOUNDARY_TEXT);
  });

  test("bubbles to parent in action script transitions from self", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto(NO_BOUNDARY_ACTION);
    await app.clickSubmitButton(NO_BOUNDARY_ACTION);
    expect(await app.getHtml("main")).toMatch(ROOT_BOUNDARY_TEXT);
  });

  test("own boundary, loader, document request", async () => {
    let res = await fixture.requestDocument(HAS_BOUNDARY_LOADER);
    expect(res.status).toBe(500);
    expect(await res.text()).toMatch(OWN_BOUNDARY_TEXT);
  });

  test("own boundary, loader, client transition", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");
    await app.clickLink(HAS_BOUNDARY_LOADER);
    expect(await app.getHtml("main")).toMatch(OWN_BOUNDARY_TEXT);
  });

  test("bubbles to parent in loader document requests", async () => {
    let res = await fixture.requestDocument(NO_BOUNDARY_LOADER);
    expect(res.status).toBe(500);
    expect(await res.text()).toMatch(ROOT_BOUNDARY_TEXT);
  });

  test("bubbles to parent in loader script transitions from other routes", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");
    await app.clickLink(NO_BOUNDARY_LOADER);
    expect(await app.getHtml("main")).toMatch(ROOT_BOUNDARY_TEXT);
  });

  test("ssr rendering errors with no boundary", async () => {
    let res = await fixture.requestDocument(NO_BOUNDARY_RENDER);
    expect(res.status).toBe(500);
    expect(await res.text()).toMatch(ROOT_BOUNDARY_TEXT);
  });

  test("script transition rendering errors with no boundary", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");
    await app.clickLink(NO_BOUNDARY_RENDER);
    expect(await app.getHtml("main")).toMatch(ROOT_BOUNDARY_TEXT);
  });

  test("ssr rendering errors with boundary", async () => {
    let res = await fixture.requestDocument(HAS_BOUNDARY_RENDER);
    expect(res.status).toBe(500);
    expect(await res.text()).toMatch(OWN_BOUNDARY_TEXT);
  });

  test("script transition rendering errors with boundary", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");
    await app.clickLink(HAS_BOUNDARY_RENDER);
    expect(await app.getHtml("main")).toMatch(OWN_BOUNDARY_TEXT);
  });

  test("ssr renders error boundary when meta throws", async () => {
    let res = await fixture.requestDocument(META_ERROR);
    expect(res.status).toBe(500);
    expect(await res.text()).toMatch(ROOT_BOUNDARY_TEXT);
  });

  test("script transition renders error boundary when meta throws", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");
    await app.clickLink(META_ERROR);
    expect(await app.getHtml("main")).toMatch(ROOT_BOUNDARY_TEXT);
  });

  test("ssr renders error boundary when links function throws", async () => {
    let res = await fixture.requestDocument(LINKS_ERROR);
    expect(res.status).toBe(500);
    expect(await res.text()).toMatch(ROOT_BOUNDARY_TEXT);
  });

  test("script transition renders error boundary when links function throws", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/");
    await app.clickLink(LINKS_ERROR);
    expect(await app.getHtml("main")).toMatch(ROOT_BOUNDARY_TEXT);
  });

  test("uses correct error boundary on server action errors in nested routes", async ({
    page,
  }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto(`/action/child-error`);
    expect(await app.getHtml("#parent-data")).toMatch("PARENT");
    expect(await app.getHtml("#child-data")).toMatch("CHILD");
    await page.click("button[type=submit]");
    await page.waitForSelector("#child-error");
    // Preserves parent loader data
    expect(await app.getHtml("#parent-data")).toMatch("PARENT");
    expect(await app.getHtml("#child-error")).toMatch("Broken!");
  });

  test.describe("if no error boundary exists in the app", () => {
    let NO_ROOT_BOUNDARY_LOADER = "/loader-bad";
    let NO_ROOT_BOUNDARY_ACTION = "/action-bad";
    let NO_ROOT_BOUNDARY_ACTION_RETURN = "/action-no-return";
    let META_ERROR = "/meta-error";
    let LINKS_ERROR = "/links-error";

    test.beforeAll(async () => {
      fixture = await createFixture({
        files: {
          "app/root.jsx": js`
            import { Links, Meta, Outlet, Scripts } from "@remix-run/react";

            export default function Root() {
              return (
                <html lang="en">
                  <head>
                    <Meta />
                    <Links />
                  </head>
                  <body>
                    <Outlet />
                    <Scripts />
                  </body>
                </html>
              );
            }
          `,

          "app/routes/index.jsx": js`
            import { Link, Form } from "@remix-run/react";

            export default function () {
              return (
                <div>
                  <h1>Home</h1>
                  <Form method="post">
                    <button formAction="${NO_ROOT_BOUNDARY_ACTION}" type="submit">
                      Action go boom
                    </button>
                    <button formAction="${NO_ROOT_BOUNDARY_ACTION_RETURN}" type="submit">
                      Action no return
                    </button>
                  </Form>
                  <p>
                    <Link to="${META_ERROR}">
                      ${META_ERROR}
                    </Link>
                  </p>
                  <p>
                    <Link to="${LINKS_ERROR}">
                      ${LINKS_ERROR}
                    </Link>
                  </p>
                </div>
              )
            }
          `,

          [`app/routes${NO_ROOT_BOUNDARY_LOADER}.jsx`]: js`
            import { Link, Form } from "@remix-run/react";

            export async function loader() {
              throw Error("BLARGH");
            }

            export default function () {
              return (
                <div>
                  <h1>Hello</h1>
                </div>
              )
            }
          `,

          [`app/routes${NO_ROOT_BOUNDARY_ACTION}.jsx`]: js`
            import { Link, Form } from "@remix-run/react";

            export async function action() {
              throw Error("YOOOOOOOO WHAT ARE YOU DOING");
            }

            export default function () {
              return (
                <div>
                  <h1>Goodbye</h1>
                </div>
              )
            }
          `,

          [`app/routes${NO_ROOT_BOUNDARY_ACTION_RETURN}.jsx`]: js`
            import { Link, Form, useActionData } from "@remix-run/react";

            export async function action() {}

            export default function () {
              let data = useActionData();
              return (
                <div>
                  <h1>{data}</h1>
                </div>
              )
            }
          `,

          [`app/routes${LINKS_ERROR}.jsx`]: js`
          export function links() {
            throw new Error("Kaboom!")
          }

          export default function () {
            return <div/>
          }
        `,

          [`app/routes${META_ERROR}.jsx`]: js`
            export function meta() {
              throw new Error("Kaboom!")
            }

            export default function () {
              return <div/>
            }
          `,
        },
      });
      appFixture = await createAppFixture(fixture);
    });

    test("bubbles to internal boundary in loader document requests", async ({
      page,
    }) => {
      let app = new PlaywrightFixture(appFixture, page);
      await app.goto(NO_ROOT_BOUNDARY_LOADER);
      expect(await app.getHtml("h1")).toMatch(INTERNAL_ERROR_BOUNDARY_HEADING);
    });

    test("bubbles to internal boundary in action script transitions from other routes", async ({
      page,
    }) => {
      let app = new PlaywrightFixture(appFixture, page);
      await app.goto("/");
      await app.clickSubmitButton(NO_ROOT_BOUNDARY_ACTION);
      expect(await app.getHtml("h1")).toMatch(INTERNAL_ERROR_BOUNDARY_HEADING);
    });

    test("bubbles to internal boundary if action doesn't return", async ({
      page,
    }) => {
      let app = new PlaywrightFixture(appFixture, page);
      await app.goto("/");
      await app.clickSubmitButton(NO_ROOT_BOUNDARY_ACTION_RETURN);
      expect(await app.getHtml("h1")).toMatch(INTERNAL_ERROR_BOUNDARY_HEADING);
    });

    test("ssr renders error boundary when meta throws", async () => {
      let res = await fixture.requestDocument(META_ERROR);
      expect(res.status).toBe(500);
      expect(selectHtml(await res.text(), "h1")).toMatch(
        INTERNAL_ERROR_BOUNDARY_HEADING
      );
    });

    test("script transition renders error boundary when meta throws", async ({
      page,
    }) => {
      let app = new PlaywrightFixture(appFixture, page);
      await app.goto("/");
      await app.clickLink(META_ERROR);
      expect(await app.getHtml("h1")).toMatch(INTERNAL_ERROR_BOUNDARY_HEADING);
    });

    test("ssr renders error boundary when links function throws", async () => {
      let res = await fixture.requestDocument(LINKS_ERROR);
      expect(res.status).toBe(500);
      expect(selectHtml(await res.text(), "h1")).toMatch(
        INTERNAL_ERROR_BOUNDARY_HEADING
      );
    });

    test("script transition renders error boundary when links function throws", async ({
      page,
    }) => {
      let app = new PlaywrightFixture(appFixture, page);
      await app.goto("/");
      await app.clickLink(LINKS_ERROR);
      expect(await app.getHtml("h1")).toMatch(INTERNAL_ERROR_BOUNDARY_HEADING);
    });
  });
});
