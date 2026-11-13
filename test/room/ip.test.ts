import { test } from "node:test";
import assert from "node:assert/strict";
import { limitKey } from "../../src/room/ip.ts";

test("IPv4 addresses and unknown values are kept as they are", () => {
  assert.equal(limitKey("203.0.113.7"), "203.0.113.7");
  assert.equal(limitKey("unknown"), "unknown");
});

test("IPv6 addresses in the same /64 share a key, however they are written", () => {
  const key = "2001:db8:1:2::/64";
  assert.equal(limitKey("2001:db8:1:2::1"), key);
  assert.equal(limitKey("2001:db8:1:2:aaaa:bbbb:cccc:dddd"), key);
  assert.equal(limitKey("2001:0DB8:0001:0002:0000:0000:0000:0001"), key);
  assert.equal(limitKey("2001:db8:1:2:ffff:ffff:ffff:ffff%eth0"), key);
});

test("different /64 prefixes get different keys", () => {
  assert.notEqual(limitKey("2001:db8:1:2::1"), limitKey("2001:db8:1:3::1"));
  assert.notEqual(limitKey("2001:db8:1:2::1"), limitKey("2001:db9:1:2::1"));
});

test("compressed forms that start, end or consist of :: expand correctly", () => {
  assert.equal(limitKey("::1"), "0:0:0:0::/64");
  assert.equal(limitKey("::"), "0:0:0:0::/64");
  assert.equal(limitKey("2001:db8::"), "2001:db8:0:0::/64");
  assert.equal(limitKey("fe80::1:2"), "fe80:0:0:0::/64");
});

test("IPv4-mapped IPv6 is keyed as the IPv4 address", () => {
  assert.equal(limitKey("::ffff:203.0.113.7"), "203.0.113.7");
  assert.equal(limitKey("::ffff:cb00:7107"), "203.0.113.7");
});

test("malformed IPv6 is kept as is rather than collapsed into a shared key", () => {
  for (const bad of ["1::2::3", "1:2:3:4:5:6:7:8:9", "zzzz::1", "12345::1", ":::"]) assert.equal(limitKey(bad), bad);
});
