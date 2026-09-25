package hashTheVin;

import java.util.ArrayList;
import java.util.LinkedList;
import java.util.List;

class Vehicle {
    private String vin;
    private String make;
    private String model;
    private String color;
    private String year;

    public Vehicle(String v, String ma, String mo, String cl, String ye) {
        vin = v;
        make = ma;
        model = mo;
        color = cl;
        year = ye;
    }

    public String getVIN() {
        return vin;
    }

    public String getMake() {
        return make;
    }

    public String getModel() {
        return model;
    }

    public String getColor() {
        return color;
    }

    public String getYear() {
        return year;
    }

    public void update(Vehicle vehicle) {
        make = vehicle.getMake();
        model = vehicle.getModel();
        color = vehicle.getColor();
        year = vehicle.getYear();
    }

    public void printVehicle() {
        System.out.println("MAKE: " + make + "\t" + "MODEL: " + model + "\t" + "COLOR: " + color + "\t" + "YEAR: " + year);
    }
}