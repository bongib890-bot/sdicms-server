-- ===========================================================================
--  SDICMS — Append-only guarantees
--  The audit log and the chain of custody are evidence about evidence. A
--  convention that "the application never updates them" is not enough: these
--  triggers make an UPDATE or DELETE fail at the database, even from a client
--  with direct credentials.
-- ===========================================================================

DROP TRIGGER IF EXISTS trg_audit_no_update;
DROP TRIGGER IF EXISTS trg_audit_no_delete;
DROP TRIGGER IF EXISTS trg_custody_no_update;
DROP TRIGGER IF EXISTS trg_custody_no_delete;

DELIMITER //

CREATE TRIGGER trg_audit_no_update BEFORE UPDATE ON audit_log
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'audit_log is append-only: UPDATE is not permitted';
END//

CREATE TRIGGER trg_audit_no_delete BEFORE DELETE ON audit_log
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'audit_log is append-only: DELETE is not permitted';
END//

CREATE TRIGGER trg_custody_no_update BEFORE UPDATE ON custody_chain
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'custody_chain is append-only: UPDATE is not permitted';
END//

CREATE TRIGGER trg_custody_no_delete BEFORE DELETE ON custody_chain
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'custody_chain is append-only: DELETE is not permitted';
END//

DELIMITER ;
