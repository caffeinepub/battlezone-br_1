import Time "mo:core/Time";
import Array "mo:core/Array";
import List "mo:core/List";
import Iter "mo:core/Iter";
import Order "mo:core/Order";

actor {
  var nextId = 0;
  let leaderboard = List.empty<Entry>();

  type Entry = {
    id : Nat;
    playerName : Text;
    kills : Nat;
    placement : Nat;
    survivalTime : Nat;
    timestamp : Time.Time;
  };

  module Entry {
    public func compareKillsDescending(a : Entry, b : Entry) : Order.Order {
      if (a.kills > b.kills) { #less } else if (a.kills < b.kills) {
        #greater;
      } else { #equal };
    };

    public func comparePlacementAscending(a : Entry, b : Entry) : Order.Order {
      if (a.placement < b.placement) { #less } else if (a.placement > b.placement) {
        #greater;
      } else { #equal };
    };
  };

  public shared ({ caller }) func submitMatch(playerName : Text, kills : Nat, placement : Nat, survivalTime : Nat) : async Nat {
    let id = nextId;
    nextId += 1;

    let entry : Entry = {
      id;
      playerName;
      kills;
      placement;
      survivalTime;
      timestamp = Time.now();
    };

    leaderboard.add(entry);
    id;
  };

  public query ({ caller }) func getTopKills() : async [Entry] {
    let sortedEntries = leaderboard.toArray().sort(Entry.compareKillsDescending);
    let sliceSize = if (sortedEntries.size() < 10) { sortedEntries.size() } else { 10 };
    sortedEntries.sliceToArray(0, sliceSize);
  };

  public query ({ caller }) func getTopPlacements() : async [Entry] {
    let sortedEntries = leaderboard.toArray().sort(Entry.comparePlacementAscending);
    let sliceSize = if (sortedEntries.size() < 10) { sortedEntries.size() } else { 10 };
    sortedEntries.sliceToArray(0, sliceSize);
  };

  public query ({ caller }) func getAllEntries() : async [Entry] {
    leaderboard.values().toArray();
  };
};
