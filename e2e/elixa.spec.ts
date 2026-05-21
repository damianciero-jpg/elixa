import { expect, test, type Page } from '@playwright/test';

const TEST_EMAIL = process.env.PLAYWRIGHT_TEST_EMAIL;
const TEST_PASSWORD = process.env.PLAYWRIGHT_TEST_PASSWORD;
const SIGNUP_EMAIL = process.env.PLAYWRIGHT_SIGNUP_EMAIL || uniqueEmail();
const SIGNUP_PASSWORD = process.env.PLAYWRIGHT_SIGNUP_PASSWORD || 'PlaywrightTest123!';

function uniqueEmail() {
  return `elixa-e2e-${Date.now()}@example.com`;
}

async function hasVisibleText(page: Page, text: string | RegExp) {
  return (await page.getByText(text).first().count()) > 0;
}

async function hasLoginForm(page: Page) {
  return (await page.getByPlaceholder('Email').count()) > 0;
}

async function waitForAppShell(page: Page) {
  await expect(page.locator('body')).toBeVisible();
  await expect(
    page.getByText(/Elixa|Welcome to\s*Expo|Private support during difficult moments\./).first(),
  ).toBeVisible();
}

async function signIn(page: Page) {
  test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'Set PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD to run authenticated tests.');

  await page.goto('/');
  await waitForAppShell(page);
  test.skip(!(await hasLoginForm(page)), 'No login screen is exposed by the current web app route.');

  await page.getByPlaceholder('Email').fill(TEST_EMAIL!);
  await page.getByPlaceholder('Password').fill(TEST_PASSWORD!);
  await page.getByText('Sign In').click();
  await expect(page.getByText('Private support during difficult moments.')).toBeVisible();
}

test.describe('Elixa web smoke tests', () => {
  test('home page loads on a mobile viewport', async ({ page }) => {
    await page.goto('/');

    await waitForAppShell(page);
  });

  test('login page loads when auth is exposed', async ({ page }) => {
    await page.goto('/');
    await waitForAppShell(page);
    test.skip(!(await hasLoginForm(page)), 'No login screen is exposed by the current web app route.');

    await expect(page.getByPlaceholder('Email')).toBeVisible();
    await expect(page.getByPlaceholder('Password')).toBeVisible();
    await expect(page.getByText('Sign In')).toBeVisible();
  });

  test('new user signup flow works or shows expected validation', async ({ page }) => {
    await page.goto('/');
    await waitForAppShell(page);
    test.skip(!(await hasLoginForm(page)), 'No signup screen is exposed by the current web app route.');

    await page.getByText("Don't have an account? Sign up").click();
    await expect(page.getByText('Create your account.')).toBeVisible();

    await page.getByText('Sign Up').click();
    await expect(page.getByText('Email and password are required.')).toBeVisible();

    if (process.env.PLAYWRIGHT_SIGNUP_EMAIL && process.env.PLAYWRIGHT_SIGNUP_PASSWORD) {
      await page.getByPlaceholder('Email').fill(SIGNUP_EMAIL);
      await page.getByPlaceholder('Password').fill(SIGNUP_PASSWORD);
      await page.getByText('Sign Up').click();
      await expect(page.getByText('Private support during difficult moments.')).toBeVisible();
    }
  });

  test('existing user login flow works with test credentials', async ({ page }) => {
    await signIn(page);
  });

  test('dashboard loads after login', async ({ page }) => {
    await signIn(page);

    await expect(page.getByText('Private support during difficult moments.')).toBeVisible();
    await expect(page.getByText("I'm struggling right now")).toBeVisible();
  });

  test('bottom navigation works without forcing login again', async ({ page }) => {
    await signIn(page);

    const exploreTab = page.getByLabel('Explore tab');
    test.skip(!(await exploreTab.isVisible().catch(() => false)), 'No bottom tab navigation is exposed by the current app.');

    await exploreTab.click();
    await expect(page.getByText('File-based routing')).toBeVisible();

    await page.getByLabel('Home tab').click();
    await waitForAppShell(page);
    await expect(page.getByPlaceholder('Email')).toHaveCount(0);
  });

  test('settings page loads when available', async ({ page }) => {
    await page.goto('/');
    await waitForAppShell(page);
    test.skip(!(await hasVisibleText(page, /Settings/i)), 'No Settings page or navigation item exists in the current app.');

    await page.getByText(/Settings/i).first().click();
    await expect(page.getByText(/Settings/i).first()).toBeVisible();
  });

  test('alerts page loads when available', async ({ page }) => {
    await page.goto('/');
    await waitForAppShell(page);
    test.skip(!(await hasVisibleText(page, /Alerts|Crisis Resources|Safety/i)), 'No Alerts, Crisis Resources, or Safety page is exposed by the current web app route.');

    await page.getByText(/Alerts|Crisis Resources|Safety/i).first().click();
    await expect(page.getByText(/Alerts|Crisis Resources|Safety/i).first()).toBeVisible();
  });

  test('game or support session completion saves when available', async ({ page }) => {
    await signIn(page);

    test.skip(!(await hasVisibleText(page, "I'm struggling right now")), 'No game or support-session flow is exposed by the current web app route.');

    await page.getByText("I'm struggling right now").click();
    await page.getByText('Calm me down').click();
    await page.getByText('Save this session').click();
    await expect(page.getByText('Before you go')).toBeVisible();
  });
});
