import { test, expect } from "playwright-test-coverage";
import { Role, User } from "../src/service/pizzaService";
import { Page } from "@playwright/test";

async function basicInit(page: Page) {
  let loggedInUser: User | undefined;
  const validUsers: Record<string, User> = {
    "d@jwt.com": {
      id: "1",
      name: "dinerUser",
      email: "d@jwt.com",
      password: "diner",
      roles: [{ role: Role.Diner }],
    },
    "f@jwt.com": {
      id: "2",
      name: "franchiseeUser",
      email: "f@jwt.com",
      password: "franchisee",
      roles: [{ role: Role.Franchisee }],
    },
    "a@jwt.com": {
      id: "3",
      name: "adminUser",
      email: "a@jwt.com",
      password: "admin",
      roles: [{ role: Role.Admin }],
    },
  };

  // Login a user mock endpoint
  await page.route("*/**/api/auth", async (route) => {
    const method = route.request().method();
    if (method == "PUT") {
      const loginReq = route.request().postDataJSON();
      const user = validUsers[loginReq.email];
      if (!user || user.password !== loginReq.password) {
        await route.fulfill({ status: 401, json: { error: "Unauthorized" } });
        return;
      }
      loggedInUser = validUsers[loginReq.email];
      const loginRes = {
        user: loggedInUser,
        token: "abcdef",
      };
      expect(route.request().method()).toBe("PUT");
      await route.fulfill({ json: loginRes });
    }
  });

  // Update user mock endpoint
  await page.route(/\/api\/user\/\d+$/, async (route) => {
    const method = route.request().method();
    if (method == "PUT") {
      const loginReq = route.request().postDataJSON();

      const userEntry = Object.entries(validUsers).find(
        ([, user]) => user.id === loginReq.id
      );

      if (!userEntry) {
        await route.fulfill({ status: 404, json: { error: "User not found" } });
        return;
      }

      const [oldEmail, oldUser] = userEntry;

      const newUser = JSON.parse(JSON.stringify(oldUser));
      delete validUsers[oldEmail];

      newUser.name = loginReq.name || oldUser.name;
      newUser.email = loginReq.email || oldUser.email;
      newUser.password = loginReq.password || oldUser.password;

      validUsers[newUser.email] = newUser;

      const loginRes = {
        user: newUser,
        token: "abcdef",
      };
      expect(route.request().method()).toBe("PUT");
      await route.fulfill({ json: loginRes });
    }
  });

  await page.route(/\/api\/user\?.+$/, async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      const users = Object.values(validUsers).map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        roles: u.roles,
      }));

      await route.fulfill({
        json: {
          users,
          more: false,
        },
      });
    }
  });

  // Return the currently logged in user
  await page.route("*/**/api/user/me", async (route) => {
    expect(route.request().method()).toBe("GET");
    await route.fulfill({ json: loggedInUser });
  });

  await page.route(/\/api\/franchise\?.+$/, async (route) => {
    const method = route.request().method();
    if (method == "GET") {
      const franchises = {
        franchises: [],
        more: false,
      };
      await route.fulfill({ json: franchises });
    }
  });

  await page.goto("/");
}

test("updateDiner", async ({ page }) => {
  await basicInit(page);

  await updateUserTestFlow(
    page,
    "dinerUser",
    "d@jwt.com",
    "diner",
    "dinerUser2",
    "d2@jwt.com",
    "diner2"
  );
});

test("updateFranchisee", async ({ page }) => {
  await basicInit(page);

  await updateUserTestFlow(
    page,
    "franchiseeUser",
    "f@jwt.com",
    "franchisee",
    "franchiseeUser2",
    "f2@jwt.com",
    "franchisee2"
  );
});

test("updateAdmin", async ({ page }) => {
  await basicInit(page);

  await updateUserTestFlow(
    page,
    "adminUser",
    "a@jwt.com",
    "admin",
    "adminUser2",
    "a2@jwt.com",
    "admin2"
  );
});

test("admin dashboard user table", async ({ page }) => {
  await basicInit(page);

  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill("a@jwt.com");
  await page.getByRole("textbox", { name: "Password" }).fill("admin");
  await page.getByRole("button", { name: "Login" }).click();
  await page.getByRole("link", { name: "Admin" }).click();
  
});

async function updateUserTestFlow(
  page: Page,
  initialName: string,
  initialEmail: string,
  initialPassword: string,
  changedName: string,
  changedEmail: string,
  changedPassword: string
) {
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill(initialEmail);
  await page.getByRole("textbox", { name: "Password" }).fill(initialPassword);
  await page.getByRole("button", { name: "Login" }).click();
  await page.getByRole("link", { name: initialEmail[0], exact: true }).click();
  await expect(page.getByText("Your pizza kitchen")).toBeVisible();
  await expect(page.getByText(initialName)).toBeVisible();

  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("textbox").first().fill(changedName);
  await page.getByRole("button", { name: "Update" }).click();

  await page.getByRole("link", { name: "Logout" }).click();
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill(initialEmail);
  await page.getByRole("textbox", { name: "Password" }).fill(initialPassword);
  await page.getByRole("button", { name: "Login" }).click();
  await page.getByRole("link", { name: changedName[0], exact: true }).click();
  await expect(page.getByText(changedName)).toBeVisible();

  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("textbox").nth(1).fill(changedEmail);
  await page.getByRole("button", { name: "Update" }).click();

  await page.getByRole("link", { name: "Logout" }).click();
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill(changedEmail);
  await page.getByRole("textbox", { name: "Password" }).fill(initialPassword);
  await page.getByRole("button", { name: "Login" }).click();
  await page.getByRole("link", { name: changedName[0], exact: true }).click();
  await expect(page.getByText(changedEmail)).toBeVisible();

  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("textbox").nth(2).fill(changedPassword);
  await page.getByRole("button", { name: "Update" }).click();

  await page.getByRole("link", { name: "Logout" }).click();
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill(changedEmail);
  await page.getByRole("textbox", { name: "Password" }).fill(changedPassword);
  await page.getByRole("button", { name: "Login" }).click();
  await page.getByRole("link", { name: changedName[0], exact: true }).click();
}
