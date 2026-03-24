package com.nearbite.restaurant;

import android.util.Base64;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;

/**
 * NetworkPrinterPlugin — sends raw ESC/POS bytes to a network printer via TCP.
 *
 * Supported printers: Epson TM-T82X, TM-T20, TM-T88, and any other printer
 * that accepts raw ESC/POS on port 9100 (most network thermal printers do).
 *
 * Methods:
 *   print({ host, port, data })        — send base64-encoded ESC/POS bytes
 *   testConnection({ host, port })      — verify TCP reachability (no data sent)
 */
@CapacitorPlugin(name = "NetworkPrinter")
public class NetworkPrinterPlugin extends Plugin {

    private static final int CONNECT_TIMEOUT_MS = 8_000;
    private static final int SOCKET_TIMEOUT_MS  = 15_000;

    /**
     * Connects to host:port via TCP and sends the base64-encoded ESC/POS data.
     * Runs on a background thread to avoid blocking the UI.
     */
    @PluginMethod
    public void print(PluginCall call) {
        final String host = call.getString("host");
        final int    port = call.getInt("port", 9100);
        final String data = call.getString("data"); // base64

        if (host == null || host.isEmpty()) {
            call.reject("NetworkPrinterPlugin: 'host' is required");
            return;
        }
        if (data == null || data.isEmpty()) {
            call.reject("NetworkPrinterPlugin: 'data' is required");
            return;
        }

        new Thread(() -> {
            try {
                byte[] bytes = Base64.decode(data, Base64.DEFAULT);

                Socket socket = new Socket();
                socket.setSoTimeout(SOCKET_TIMEOUT_MS);
                socket.connect(new InetSocketAddress(host, port), CONNECT_TIMEOUT_MS);

                OutputStream out = socket.getOutputStream();
                out.write(bytes);
                out.flush();
                socket.close();

                call.resolve();
            } catch (Exception e) {
                call.reject("NetworkPrinterPlugin: print failed — " + e.getMessage());
            }
        }).start();
    }

    /**
     * Checks if the printer is reachable on the network by opening a TCP socket.
     * Sends no data — purely a connectivity check.
     */
    @PluginMethod
    public void testConnection(PluginCall call) {
        final String host = call.getString("host");
        final int    port = call.getInt("port", 9100);

        if (host == null || host.isEmpty()) {
            call.reject("NetworkPrinterPlugin: 'host' is required");
            return;
        }

        new Thread(() -> {
            try {
                Socket socket = new Socket();
                socket.connect(new InetSocketAddress(host, port), CONNECT_TIMEOUT_MS);
                socket.close();
                call.resolve();
            } catch (Exception e) {
                call.reject("Cannot reach printer at " + host + ":" + port + " — " + e.getMessage());
            }
        }).start();
    }
}
