

CREATE DATABASE HospitalDB;
USE HospitalDB;

CREATE TABLE DRUGS (
    DRUGID INT PRIMARY KEY,
    DRUGNAME VARCHAR(100) NOT NULL
);

CREATE TABLE DIAGNOSIS (
    DIAGID INT PRIMARY KEY,
    DIAGNOSIS VARCHAR(100) NOT NULL
);

CREATE TABLE WARDS (
    WARDID INT PRIMARY KEY,
    WARDNAME VARCHAR(100) NOT NULL
);

CREATE TABLE NURSES (
    NURSEID INT PRIMARY KEY,
    NURSENAME VARCHAR(100) NOT NULL,
    WARDID INT,
    FOREIGN KEY (WARDID) REFERENCES WARDS(WARDID)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE TABLE PATIENTS (
    PID INT PRIMARY KEY,
    PNAME VARCHAR(100) NOT NULL,
    DOB DATE,
    GENDER VARCHAR(10),
    HFEES DECIMAL(10,2),
    DIAGID INT,
    DRUGID INT,
    NURSEID INT,
    FOREIGN KEY (DIAGID) REFERENCES DIAGNOSIS(DIAGID)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    FOREIGN KEY (DRUGID) REFERENCES DRUGS(DRUGID)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    FOREIGN KEY (NURSEID) REFERENCES NURSES(NURSEID)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);



INSERT INTO DRUGS VALUES
(1,'Paracetamol'), (2,'Ibuprofen'), (3,'Amoxicillin'),
(4,'Ciprofloxacin'), (5,'Metformin'),
(6,'Aspirin'), (7,'Insulin'),
(8,'Omeprazole'), (9,'Azithromycin'), (10,'Vitamin C');

INSERT INTO DIAGNOSIS VALUES
(1,'Malaria'), (2,'Typhoid'), (3,'Flu'),
(4,'Diabetes'), (5,'Hypertension'),
(6,'Asthma'), (7,'Pneumonia'),
(8,'Ulcer'), (9,'COVID-19'), (10,'Allergy');

INSERT INTO WARDS VALUES
(1,'General'), (2,'ICU'), (3,'Maternity'),
(4,'Pediatrics'), (5,'Surgical'),
(6,'Orthopedic'), (7,'Psychiatric'),
(8,'Emergency'), (9,'Oncology'), (10,'Cardiology');

INSERT INTO NURSES VALUES
(1,'Alice',1), (2,'Brenda',2), (3,'Cathy',3),
(4,'Diana',4), (5,'Eva',5),
(6,'Faith',6), (7,'Grace',7),
(8,'Hellen',8), (9,'Irene',9), (10,'Jane',10);

INSERT INTO PATIENTS VALUES
(1,'Jone Dan','1990-05-10','Male',50000,1,1,1),
(2,'Mary Jane','1985-03-15','Female',60000,2,2,2),
(3,'Peter Pan','2000-07-20','Male',45000,3,3,3),
(4,'Lucy Grey','1995-11-25','Female',70000,4,4,4),
(5,'Mark Stone','1988-02-18','Male',80000,5,5,5),
(6,'Anna Bell','1992-09-30','Female',55000,6,6,6),
(7,'Tom Hardy','1980-01-12','Male',90000,7,7,7),
(8,'Nina Ross','1998-06-08','Female',62000,8,8,8),
(9,'Chris Paul','1975-12-22','Male',75000,9,9,9),
(10,'Ella King','2001-04-05','Female',48000,10,10,10);



SELECT 
    P.PNAME,
    P.GENDER,
    P.HFEES,
    D.DIAGNOSIS,
    DR.DRUGNAME,
    W.WARDNAME,
    N.NURSENAME
FROM PATIENTS P
JOIN DIAGNOSIS D ON P.DIAGID = D.DIAGID
JOIN DRUGS DR ON P.DRUGID = DR.DRUGID
JOIN NURSES N ON P.NURSEID = N.NURSEID
JOIN WARDS W ON N.WARDID = W.WARDID;