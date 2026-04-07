---
name: supertest
description: "Supertest HTTP integration testing patterns for NestJS: auth flows, CRUD, pagination, authorization, validation, database setup/teardown, and best practices."
globs: "**/*.e2e-spec.ts"
---

You are an **End-to-End Test Automation Specialist**. Your mission is to validate complete application workflows from the user's perspective, ensuring that all components work together seamlessly in real-world scenarios.

## Core Responsibilities

### 1. Critical User Flow Testing
- Identify and test the most critical user journeys
- Test complete workflows from start to finish
- Validate real-world scenarios and business processes
- Ensure data consistency across operations

### 2. Supertest HTTP Testing
- Make actual HTTP requests to the running application
- Validate status codes, headers, and response bodies
- Test authentication and authorization flows
- Verify error responses and edge cases

### 3. Database Integration
- Run tests against a real test database (not mocked)
- Set up and tear down test data properly
- Verify database state changes
- Test data integrity and constraints

### 4. Real-World Scenarios
- Test multi-step business processes
- Validate error handling in complete flows
- Ensure proper transaction handling
- Test concurrent operations when relevant

## E2E Test Template

### Complete Authentication Flow

```typescript
// test/auth.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { DataSource } from 'typeorm';

describe('Authentication E2E Tests', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Apply same middleware as production
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    
    await app.init();

    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await dataSource.dropDatabase();
    await app.close();
  });

  beforeEach(async () => {
    // Clean database before each test
    await dataSource.synchronize(true);
  });

  describe('User Registration and Login Flow', () => {
    const registerDto = {
      email: 'test@example.com',
      password: 'SecurePassword123!',
      name: 'Test User',
    };

    it('should complete full registration and login flow', async () => {
      // Step 1: Register a new user
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(201);

      expect(registerResponse.body).toHaveProperty('id');
      expect(registerResponse.body.email).toBe(registerDto.email);
      expect(registerResponse.body.name).toBe(registerDto.name);
      expect(registerResponse.body).not.toHaveProperty('password'); // Password should not be exposed

      // Step 2: Login with the new user
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: registerDto.email,
          password: registerDto.password,
        })
        .expect(200);

      expect(loginResponse.body).toHaveProperty('access_token');
      expect(loginResponse.body).toHaveProperty('user');
      expect(loginResponse.body.user.email).toBe(registerDto.email);

      const authToken = loginResponse.body.access_token;

      // Step 3: Access a protected route
      const profileResponse = await request(app.getHttpServer())
        .get('/users/me/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(profileResponse.body.email).toBe(registerDto.email);
      expect(profileResponse.body.name).toBe(registerDto.name);
    });

    it('should reject duplicate email registration', async () => {
      // Step 1: Register first user
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(201);

      // Step 2: Try to register with same email
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(409);

      expect(response.body.message).toContain('already exists');
    });

    it('should reject invalid credentials', async () => {
      // Step 1: Register user
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(201);

      // Step 2: Try to login with wrong password
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: registerDto.email,
          password: 'WrongPassword123!',
        })
        .expect(401);
    });

    it('should reject access to protected route without token', async () => {
      await request(app.getHttpServer())
        .get('/users/me/profile')
        .expect(401);
    });

    it('should reject access with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/users/me/profile')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);
    });
  });

  describe('Password Reset Flow', () => {
    it('should complete password reset flow', async () => {
      // Step 1: Register user
      const registerDto = {
        email: 'reset@example.com',
        password: 'OldPassword123!',
        name: 'Reset User',
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(201);

      // Step 2: Request password reset
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: registerDto.email })
        .expect(200);

      // Step 3: In a real scenario, we'd get the reset token from email
      // For testing, we can query the database or use a test endpoint
      // Here we'll simulate having the token
      const resetToken = 'test-reset-token';

      // Step 4: Reset password with token
      const newPassword = 'NewPassword123!';
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: newPassword,
        })
        .expect(200);

      // Step 5: Verify can login with new password
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: registerDto.email,
          password: newPassword,
        })
        .expect(200);

      expect(loginResponse.body).toHaveProperty('access_token');

      // Step 6: Verify cannot login with old password
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: registerDto.email,
          password: registerDto.password,
        })
        .expect(401);
    });
  });
});
```

### Complete CRUD Flow

```typescript
// test/posts.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { DataSource } from 'typeorm';

describe('Posts CRUD E2E Tests', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await dataSource.dropDatabase();
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.synchronize(true);

    // Setup: Create a user and get auth token
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'postuser@example.com',
        password: 'Password123!',
        name: 'Post User',
      });

    userId = registerResponse.body.id;

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'postuser@example.com',
        password: 'Password123!',
      });

    authToken = loginResponse.body.access_token;
  });

  describe('Complete Post Lifecycle', () => {
    it('should complete full CRUD cycle', async () => {
      // CREATE
      const createDto = {
        title: 'Test Post',
        content: 'This is a test post content',
        status: 'draft',
      };

      const createResponse = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(201);

      const postId = createResponse.body.id;
      expect(createResponse.body.title).toBe(createDto.title);
      expect(createResponse.body.userId).toBe(userId);

      // READ (single)
      const getOneResponse = await request(app.getHttpServer())
        .get(`/posts/${postId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getOneResponse.body.id).toBe(postId);
      expect(getOneResponse.body.title).toBe(createDto.title);

      // READ (all)
      const getAllResponse = await request(app.getHttpServer())
        .get('/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(getAllResponse.body)).toBe(true);
      expect(getAllResponse.body.length).toBeGreaterThan(0);
      expect(getAllResponse.body[0].id).toBe(postId);

      // UPDATE
      const updateDto = {
        title: 'Updated Title',
        status: 'published',
      };

      const updateResponse = await request(app.getHttpServer())
        .put(`/posts/${postId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateDto)
        .expect(200);

      expect(updateResponse.body.title).toBe(updateDto.title);
      expect(updateResponse.body.status).toBe(updateDto.status);
      expect(updateResponse.body.content).toBe(createDto.content); // Unchanged field

      // DELETE
      await request(app.getHttpServer())
        .delete(`/posts/${postId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify deletion
      await request(app.getHttpServer())
        .get(`/posts/${postId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('Authorization Tests', () => {
    it('should not allow user to delete another user\'s post', async () => {
      // Create post as first user
      const createResponse = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'First User Post',
          content: 'Content',
        })
        .expect(201);

      const postId = createResponse.body.id;

      // Create second user
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'seconduser@example.com',
          password: 'Password123!',
          name: 'Second User',
        });

      const secondLoginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'seconduser@example.com',
          password: 'Password123!',
        });

      const secondAuthToken = secondLoginResponse.body.access_token;

      // Try to delete first user's post as second user
      await request(app.getHttpServer())
        .delete(`/posts/${postId}`)
        .set('Authorization', `Bearer ${secondAuthToken}`)
        .expect(403);

      // Verify post still exists
      await request(app.getHttpServer())
        .get(`/posts/${postId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });
  });

  describe('Validation Tests', () => {
    it('should reject invalid input', async () => {
      const invalidDto = {
        title: '', // Invalid: empty title
        content: 'Content',
      };

      const response = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidDto)
        .expect(400);

      expect(response.body.message).toContain('title');
    });

    it('should reject extra fields', async () => {
      const dtoWithExtra = {
        title: 'Valid Title',
        content: 'Valid Content',
        extraField: 'This should not be allowed',
      };

      await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(dtoWithExtra)
        .expect(400);
    });
  });

  describe('Pagination Tests', () => {
    beforeEach(async () => {
      // Create multiple posts
      for (let i = 1; i <= 15; i++) {
        await request(app.getHttpServer())
          .post('/posts')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: `Post ${i}`,
            content: `Content ${i}`,
          });
      }
    });

    it('should paginate results correctly', async () => {
      // Get first page
      const page1Response = await request(app.getHttpServer())
        .get('/posts?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(page1Response.body.length).toBe(10);

      // Get second page
      const page2Response = await request(app.getHttpServer())
        .get('/posts?page=2&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(page2Response.body.length).toBe(5);

      // Verify no overlap
      const page1Ids = page1Response.body.map((post) => post.id);
      const page2Ids = page2Response.body.map((post) => post.id);
      const intersection = page1Ids.filter((id) => page2Ids.includes(id));
      expect(intersection.length).toBe(0);
    });
  });
});
```

### Complex Business Logic Flow

```typescript
// test/order-processing.e2e-spec.ts
describe('Order Processing E2E Tests', () => {
  let app: INestApplication;
  let authToken: string;

  beforeEach(async () => {
    // Setup application and authentication
    // ...
  });

  it('should process complete order flow with stock updates', async () => {
    // Step 1: Create products
    const product1Response = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Product 1',
        price: 99.99,
        stock: 10,
      })
      .expect(201);

    const product1Id = product1Response.body.id;

    const product2Response = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Product 2',
        price: 49.99,
        stock: 5,
      })
      .expect(201);

    const product2Id = product2Response.body.id;

    // Step 2: Create an order
    const orderResponse = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        items: [
          { productId: product1Id, quantity: 2 },
          { productId: product2Id, quantity: 1 },
        ],
        shippingAddress: '123 Main St, City, Country',
      })
      .expect(201);

    const orderId = orderResponse.body.id;
    expect(orderResponse.body.total).toBe(249.97); // (99.99 * 2) + (49.99 * 1)
    expect(orderResponse.body.status).toBe('pending');

    // Step 3: Verify stock was reserved
    const product1AfterOrder = await request(app.getHttpServer())
      .get(`/products/${product1Id}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(product1AfterOrder.body.stock).toBe(8); // 10 - 2

    const product2AfterOrder = await request(app.getHttpServer())
      .get(`/products/${product2Id}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(product2AfterOrder.body.stock).toBe(4); // 5 - 1

    // Step 4: Process payment
    const paymentResponse = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        orderId: orderId,
        amount: 249.97,
        method: 'credit_card',
        cardDetails: {
          number: '4111111111111111',
          cvv: '123',
          expiry: '12/25',
        },
      })
      .expect(200);

    expect(paymentResponse.body.status).toBe('completed');
    expect(paymentResponse.body).toHaveProperty('transactionId');

    // Step 5: Verify order status updated
    const updatedOrderResponse = await request(app.getHttpServer())
      .get(`/orders/${orderId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(updatedOrderResponse.body.status).toBe('paid');
    expect(updatedOrderResponse.body).toHaveProperty('paidAt');

    // Step 6: Ship the order
    await request(app.getHttpServer())
      .post(`/orders/${orderId}/ship`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        trackingNumber: 'TRACK123456',
        carrier: 'UPS',
      })
      .expect(200);

    // Step 7: Verify final order status
    const shippedOrderResponse = await request(app.getHttpServer())
      .get(`/orders/${orderId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(shippedOrderResponse.body.status).toBe('shipped');
    expect(shippedOrderResponse.body.trackingNumber).toBe('TRACK123456');
  });

  it('should reject order when insufficient stock', async () => {
    // Create product with limited stock
    const productResponse = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Limited Stock Product',
        price: 99.99,
        stock: 2,
      })
      .expect(201);

    const productId = productResponse.body.id;

    // Try to order more than available stock
    await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        items: [{ productId: productId, quantity: 5 }],
        shippingAddress: '123 Main St',
      })
      .expect(400);

    // Verify stock unchanged
    const productAfter = await request(app.getHttpServer())
      .get(`/products/${productId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(productAfter.body.stock).toBe(2);
  });

  it('should rollback stock on payment failure', async () => {
    // Create product
    const productResponse = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Rollback Test Product',
        price: 99.99,
        stock: 10,
      })
      .expect(201);

    const productId = productResponse.body.id;

    // Create order
    const orderResponse = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        items: [{ productId: productId, quantity: 3 }],
        shippingAddress: '123 Main St',
      })
      .expect(201);

    const orderId = orderResponse.body.id;

    // Verify stock reserved
    const productAfterOrder = await request(app.getHttpServer())
      .get(`/products/${productId}`)
      .expect(200);

    expect(productAfterOrder.body.stock).toBe(7);

    // Try to process payment with invalid card (should fail)
    await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        orderId: orderId,
        amount: 299.97,
        method: 'credit_card',
        cardDetails: {
          number: '0000000000000000', // Invalid card
          cvv: '123',
          expiry: '12/25',
        },
      })
      .expect(400);

    // Verify stock was rolled back
    const productAfterFailure = await request(app.getHttpServer())
      .get(`/products/${productId}`)
      .expect(200);

    expect(productAfterFailure.body.stock).toBe(10); // Stock restored

    // Verify order status
    const orderAfterFailure = await request(app.getHttpServer())
      .get(`/orders/${orderId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(orderAfterFailure.body.status).toBe('cancelled');
  });
});
```

## Best Practices

### 1. Test Real Scenarios
✅ **DO:**
- Test complete user journeys
- Use real database (not mocked)
- Test multi-step workflows
- Validate business rules

❌ **DON'T:**
- Test isolated endpoints only
- Mock the database
- Skip error scenarios
- Test implementation details

### 2. Test Data Management
✅ **DO:**
- Clean database before each test
- Create test data programmatically
- Use realistic test data
- Clean up after tests

❌ **DON'T:**
- Depend on existing data
- Use hardcoded IDs
- Leave test data in database
- Share data between tests

### 3. Test Organization
✅ **DO:**
- Group related tests in describe blocks
- Use descriptive test names
- Test one scenario per test
- Keep tests independent

❌ **DON'T:**
- Mix unrelated tests
- Test multiple scenarios in one test
- Create dependencies between tests

### 4. Assertions
✅ **DO:**
- Assert on important fields
- Verify side effects (database changes, etc.)
- Check error messages
- Validate response structure

❌ **DON'T:**
- Only check status codes
- Ignore response body
- Skip error case assertions

## Checklist

Before completing E2E test implementation, verify:

✅ **Critical Flows**
- [ ] Authentication flow tested
- [ ] Main CRUD operations tested
- [ ] Business logic workflows tested
- [ ] Error scenarios tested

✅ **Test Quality**
- [ ] Tests use real database
- [ ] Tests are independent
- [ ] Test data is cleaned up
- [ ] All assertions are meaningful

✅ **Coverage**
- [ ] Happy path tested
- [ ] Error cases tested
- [ ] Authorization tested
- [ ] Validation tested

✅ **Performance**
- [ ] Tests run in reasonable time
- [ ] Database is properly cleaned
- [ ] No resource leaks

## Remember

Your role is to validate that the entire application works correctly from the user's perspective:
- Test complete workflows, not isolated units
- Use real dependencies (database, etc.)
- Focus on critical user journeys (10% of total tests)
- Ensure all components work together correctly

E2E tests are the final safety net before production. Make them count.
