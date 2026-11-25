import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const runWeek = async (page: Page, expected: string) => {
  await page.getByRole('button', { name: 'Run week' }).click()
  await expect(page.locator('.stats b')).toHaveText(expected)
  await expect(page.locator('.busy')).toHaveCount(0)
}

const nav = (page: Page, name: string) => page.locator('.side-group').getByRole('button', { name, exact: true }).click()

test('a CEO can run the company end to end without any API keys', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Company Sim' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start the company' })).toBeDisabled()
  await page.getByPlaceholder('Your name').fill('Brandon')
  await page.locator('label:has-text("Co-founder name") input').fill('Sam Rivera')
  await page.getByRole('button', { name: 'Start the company' }).click()

  await test.step('the first situation is waiting and a colleague answers', async () => {
    await expect(page.locator('.scenario-card')).toContainText('first marketing hire')
    await page.locator('.composer textarea').fill('I think we need a generalist. Thoughts?')
    await page.keyboard.press('Enter')
    await expect(page.locator('.msg')).toHaveCount(3)
  })

  await test.step('a decision is announced and logged', async () => {
    await page.locator('.scenario-card button').click()
    await page.locator('.modal textarea').first().fill('Hire one generalist on a three month contract.')
    await page.locator('.modal textarea').nth(1).fill('Top of funnel is the bottleneck and this is a cheap test.')
    await page.getByRole('button', { name: 'Announce decision' }).click()
    await expect(page.locator('.msg.decision')).toHaveCount(1)
    await expect(page.locator('.scenario-card')).toContainText('decided in week 1')
  })

  await test.step('time only moves when asked', async () => {
    await expect(page.locator('.stats b')).toHaveText('Week 1')
    await runWeek(page, 'Week 2')
  })

  await test.step('a role can be opened, interviewed for and filled', async () => {
    await nav(page, 'Hiring')
    await page.locator('.page textarea').fill('Own top of funnel: 50 qualified signups a month within 90 days.')
    await page.getByRole('button', { name: 'Open role' }).click()
    await expect(page.locator('.candidate')).toHaveCount(3)
    await page.locator('.candidate').first().getByRole('button', { name: 'Interview' }).click()
    await page.locator('.composer textarea').fill('Tell me about a campaign that failed.')
    await page.keyboard.press('Enter')
    await expect(page.locator('.msg')).toHaveCount(2)
    await page.getByRole('button', { name: 'Make offer' }).click()
    await expect(page.locator('.stats')).toContainText('3 people')
  })

  await test.step('delegated hiring fills without the CEO', async () => {
    await nav(page, 'Hiring')
    await page.locator('label:has-text("Reports to") select').selectOption({ index: 1 })
    await page.locator('label:has-text("Who runs the search") select').selectOption('delegated')
    await page.locator('label:has-text("How many") input').fill('4')
    await page.getByRole('button', { name: 'Open role' }).click()
    await runWeek(page, 'Week 3')
    await expect(page.locator('.stats')).toContainText('3 people')
    await runWeek(page, 'Week 4')
    await expect(page.locator('.stats')).toContainText('6 people')
  })

  await test.step('every employee has a character sheet that can be rerolled', async () => {
    await nav(page, 'People')
    const archetypes = await page.locator('tr.clickable td:nth-child(3)').allTextContents()
    expect(archetypes).toHaveLength(5)
    expect(new Set(archetypes).size).toBeGreaterThan(1)
    await page.locator('tr.clickable').first().click()
    const sheet = page.locator('.character')
    await expect(sheet).toContainText('Under pressure')
    await expect(sheet.locator('textarea')).not.toBeEmpty()
    const before = await sheet.locator('b').first().textContent()
    await page.getByRole('button', { name: 'Reroll character' }).click()
    await expect(sheet.locator('b').first()).not.toHaveText(before ?? '')
    await page.getByRole('button', { name: 'Close' }).click()
  })

  await test.step('the mentor writes a review', async () => {
    await nav(page, 'Mentor reviews')
    await page.getByRole('button', { name: 'Review my work' }).click()
    await expect(page.locator('.scores')).toBeVisible()
  })

  await test.step('mock mode spends no tokens', async () => {
    await nav(page, 'Settings')
    await expect(page.getByText('No model calls yet.')).toBeVisible()
    await expect(page.getByText('version e2e')).toBeVisible()
  })

  await test.step('state survives a reload', async () => {
    await page.waitForTimeout(600)
    await page.reload()
    await expect(page.locator('.stats b')).toHaveText('Week 4')
    await expect(page.locator('.stats')).toContainText('6 people')
  })

  expect(errors).toEqual([])
})

test('the app is not served without the password', async ({ browser }) => {
  const context = await browser.newContext({ httpCredentials: undefined })
  const response = await context.request.get('/')
  expect(response.status()).toBe(401)
  await context.close()
})
