# Message Pact Testing Reference

Contract testing for asynchronous/event-driven integrations (Kafka, RabbitMQ, custom events).

## When to Use

- Services communicate via message queues or event buses
- You need to verify the shape of events between producer and consumer
- Decoupling deployment of event producers and consumers

## Consumer Side (receives messages)

The consumer test defines what message shape it **expects** to receive.

### MessageConsumerPact

```typescript
import {
  MessageConsumerPact,
  asynchronousBodyHandler,
  MatchersV3,
} from '@pact-foundation/pact';
import path from 'path';

const { like, regex, integer, string } = MatchersV3;

const messagePact = new MessageConsumerPact({
  consumer: 'order-service',
  provider: 'book-service-events',
  dir: path.resolve(process.cwd(), 'pacts'),
  logLevel: 'warn',
});

describe('Book Events', () => {
  describe('book status updated', () => {
    it('processes a book status change event', () => {
      return messagePact
        .expectsToReceive('a book status updated event')
        .withContent({
          bookId: integer(1),
          userId: integer(1),
          workId: like('/works/OL12345W'),
          oldStatus: regex(/^(to-read|reading|read)$/, 'reading'),
          newStatus: regex(/^(to-read|reading|read)$/, 'read'),
          timestamp: like('2024-01-15T10:30:00Z'),
        })
        .withMetadata({
          contentType: 'application/json',
          topic: 'book-events',
        })
        .verify(
          asynchronousBodyHandler(async (message) => {
            // Pass message to your actual handler
            const result = await bookEventHandler.handleStatusUpdate(message);
            expect(result.processed).toBe(true);
          }),
        );
    });
  });

  describe('book created', () => {
    it('processes a new book event', () => {
      return messagePact
        .expectsToReceive('a new book created event')
        .withContent({
          bookId: integer(1),
          userId: integer(1),
          workId: like('/works/OL12345W'),
          status: like('to-read'),
          createdAt: like('2024-01-15T10:30:00Z'),
        })
        .withMetadata({
          contentType: 'application/json',
          topic: 'book-events',
        })
        .verify(
          asynchronousBodyHandler(async (message) => {
            await bookEventHandler.handleNewBook(message);
          }),
        );
    });
  });
});
```

### Key points

- `expectsToReceive()` — unique description, maps to provider's `messageProviders`
- `withContent()` — the expected message body (use matchers)
- `withMetadata()` — additional metadata (topic, content type, headers)
- `verify()` — wraps your handler; Pact injects the mock message

## Provider Side (produces messages)

The provider test proves it can **produce** the messages the consumer expects.

### MessageProviderPact

```typescript
import { MessageProviderPact, providerWithMetadata } from '@pact-foundation/pact';
import path from 'path';

describe('Book Service Message Provider', () => {
  const opts = {
    pactUrls: [
      path.resolve(
        process.cwd(),
        'pacts/order-service-book-service-events.json',
      ),
    ],

    // Map interaction descriptions to producer functions
    messageProviders: {
      'a book status updated event': providerWithMetadata(
        () => ({
          bookId: 42,
          userId: 1,
          workId: '/works/OL12345W',
          oldStatus: 'reading',
          newStatus: 'read',
          timestamp: new Date().toISOString(),
        }),
        {
          contentType: 'application/json',
          topic: 'book-events',
        },
      ),

      'a new book created event': providerWithMetadata(
        () => ({
          bookId: 43,
          userId: 1,
          workId: '/works/OL67890W',
          status: 'to-read',
          createdAt: new Date().toISOString(),
        }),
        {
          contentType: 'application/json',
          topic: 'book-events',
        },
      ),
    },

    // State handlers for message tests
    stateHandlers: {
      'book exists': async () => {
        // Seed data if needed
      },
    },

    providerVersion: process.env.GIT_COMMIT || '1.0.0',
    publishVerificationResult: process.env.CI === 'true',
  };

  it('verifies message contracts', () => {
    return new MessageProviderPact(opts).verify();
  });
});
```

### `providerWithMetadata(producer, metadata)`

Wraps a message producer function with metadata. The producer function returns the message body; the metadata is checked separately.

```typescript
providerWithMetadata(
  () => createOrderEvent(order),  // Returns message body
  { topic: 'orders', contentType: 'application/json' },  // Metadata
)
```

## PactV4 Message Interactions

V4 supports mixed HTTP + message interactions in a single pact file.

### Consumer

```typescript
import { PactV4, MatchersV3 } from '@pact-foundation/pact';

const pact = new PactV4({
  consumer: 'order-service',
  provider: 'book-service',
  spec: SpecificationVersion.SPECIFICATION_VERSION_V4,
});

// HTTP interaction
pact
  .addInteraction()
  .given('books exist')
  .uponReceiving('a request for books')
  .withRequest('GET', '/books')
  .willRespondWith(200, (b) => b.jsonBody(eachLike({ id: 1 })));

// Message interaction (same pact file)
pact
  .addAsynchronousInteraction('a book status change event')
  .given('book 1 exists')
  .withContent({
    bookId: integer(1),
    newStatus: regex(/^(to-read|reading|read)$/, 'read'),
  })
  .withMetadata({ topic: 'book-events' });
```

## Python Message Pact

### Consumer

```python
from pact import MessageConsumer, Provider

message_pact = MessageConsumer('order-service').has_pact_with(
    Provider('book-service-events'),
    pact_dir='./pacts',
)

def test_book_status_event():
    expected_event = {
        'bookId': 1,
        'newStatus': 'read',
        'timestamp': '2024-01-15T10:30:00Z',
    }

    (message_pact
     .given('book exists')
     .expects_to_receive('a book status change event')
     .with_content(expected_event)
     .with_metadata({'topic': 'book-events'}))

    with message_pact:
        # Process the message
        handler = BookEventHandler()
        handler.process(expected_event)
```

## Best Practices

- **Description strings are the key** — consumer's `expectsToReceive` must exactly match provider's `messageProviders` key
- **Test your real handler** — pass the mock message to the actual handler function
- **Include metadata** — topic names, content types, and headers are part of the contract
- **Keep events small** — events should carry identity + delta, not full entity snapshots
- **Version your events** — include a `version` or `type` field for schema evolution
- **Separate HTTP and message pacts** — unless using V4, use different provider names (e.g., `book-service` vs `book-service-events`)
